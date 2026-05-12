import { getSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.storage");

/** Miniatura otimizada (WebP) no prefixo `{workspaceId}/{documentId}/`. */
export const DOCUMENT_THUMB_FILENAME = "__lex_thumbnail.webp";

/** Miniatura legada (PNG) — ainda removida/servida em fallback até migração completa. */
export const DOCUMENT_THUMB_LEGACY_PNG_FILENAME = "__lex_thumbnail.png";

export async function uploadDocumentBuffer(params: {
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  const env = getSupabaseEnv();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(env.STORAGE_BUCKET_DOCUMENTS)
    .upload(params.path, params.buffer, {
      contentType: params.contentType,
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export async function downloadDocumentBuffer(path: string): Promise<Buffer> {
  const env = getSupabaseEnv();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(env.STORAGE_BUCKET_DOCUMENTS).download(path);
  if (error || !data) throw new Error(error?.message ?? "Download falhou");
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

/** Download sem lançar: útil para miniaturas cacheadas no Storage. */
export async function tryDownloadDocumentBuffer(path: string): Promise<Buffer | null> {
  try {
    return await downloadDocumentBuffer(path);
  } catch {
    return null;
  }
}

/**
 * Apaga arquivo do bucket de documentos. Não falha hard se o arquivo já
 * não existir no Storage (entrega "best-effort"); apenas loga e segue.
 */
export async function removeDocumentBuffer(path: string): Promise<void> {
  const env = getSupabaseEnv();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(env.STORAGE_BUCKET_DOCUMENTS).remove([path]);
  if (error) {
    // Storage costuma devolver erro se o objeto não existe — loga e segue (sem path bruto).
    log.warn("storage remove failed (non-fatal)", {
      pathLen: path.length,
      err: { message: error.message },
    });
  }
}

export function documentStoragePath(workspaceId: string, documentId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${workspaceId}/${documentId}/${safe}`;
}

/** WebP de capa gerado uma vez por documento (mesmo prefixo que o PDF). */
export function documentThumbnailStoragePath(workspaceId: string, documentId: string): string {
  return `${workspaceId}/${documentId}/${DOCUMENT_THUMB_FILENAME}`;
}

/** Caminho da miniatura PNG antiga (migração / fallback GET). */
export function documentThumbnailLegacyPngStoragePath(workspaceId: string, documentId: string): string {
  return `${workspaceId}/${documentId}/${DOCUMENT_THUMB_LEGACY_PNG_FILENAME}`;
}

/** Remove WebP atual e PNG legado (best-effort). */
export async function removeDocumentThumbnails(workspaceId: string, documentId: string): Promise<void> {
  await removeDocumentBuffer(documentThumbnailStoragePath(workspaceId, documentId));
  await removeDocumentBuffer(documentThumbnailLegacyPngStoragePath(workspaceId, documentId));
}
