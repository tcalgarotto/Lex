import { getSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

export function documentStoragePath(workspaceId: string, documentId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${workspaceId}/${documentId}/${safe}`;
}
