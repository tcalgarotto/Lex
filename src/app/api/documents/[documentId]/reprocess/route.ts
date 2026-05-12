import { NextResponse } from "next/server";
import { DocumentStatus, MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { hasAtLeast } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  documentReadScopeOr,
  isPlatformSharedShelf,
} from "@/lib/biblioteca/platform-library";
import { userCanReadDocument } from "@/lib/documents/document-access";
import { inngest } from "@/lib/inngest/client";
import {
  removeDocumentThumbnails,
} from "@/lib/storage";
import { scheduleDocumentThumbnailWork } from "@/lib/documents/thumbnail-schedule";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.documents.reprocess");

/**
 * Reprocessar um documento:
 *  1. Verifica que o documento existe e é legível (workspace ativo ou catálogo global SHARED_*).
 *  2. Reseta os campos do pipeline (`status=UPLOADED`, progress, contadores).
 *  3. Apaga `DocumentChunk` antigos no Postgres (cascade-friendly).
 *  4. Apaga pontos no Qdrant — **somente** na collection `lex_main`, com
 *     filtro estrito por `documentId` E `workspaceId` do próprio documento. Nunca toca em
 *     `lex_corpus_norms` / `lex_corpus_jurisprudence` (corpus oficial).
 *  5. Reenfileira o evento Inngest `lex/document.ingest`.
 *  6. Registra `Activity kind=document.reprocess` no workspace da sessão.
 *
 * Catálogo global: advogado+ pode reprocessar documentos do workspace `lex-platform-catalog`
 * enquanto tiver outro workspace ativo na sessão.
 *
 * Em caso de falha na limpeza Qdrant, mantemos o reprocess seguindo
 * (ingest reescreverá os pontos com mesmos `chunkIndex`).
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId, user, role } = await getWorkspaceContextWithRole();
  const readScope = await documentReadScopeOr(workspaceId);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, OR: readScope },
  });
  if (!doc || doc.deletedAt) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  if (!userCanReadDocument(user.id, doc)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (doc.workspaceId !== workspaceId) {
    const canCrossReprocess =
      isPlatformSharedShelf(doc.libraryShelf) &&
      !!role &&
      hasAtLeast(role, MembershipRole.LAWYER);
    if (!canCrossReprocess) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: DocumentStatus.UPLOADED,
      errorMessage: null,
      progress: 0,
      extractedText: null,
      extractedAt: null,
      totalChunks: null,
      processedChunks: null,
      indexedAt: null,
    },
  });

  await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });

  try {
    await removeDocumentThumbnails(doc.workspaceId, doc.id);
  } catch (e) {
    log.warn("thumbnail remove before reprocess (non-fatal)", {
      documentId: doc.id,
      err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
    });
  }

  try {
    await getQdrantVectorStore().deleteByDocumentId(doc.id, doc.workspaceId);
  } catch (err) {
    log.warn("qdrant delete failed (non-fatal)", {
      workspaceId,
      documentId: doc.id,
      err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
    });
  }

  try {
    await inngest.send({ name: "lex/document.ingest", data: { documentId: doc.id } });
  } catch (e) {
    log.warn("inngest send failed (non-fatal)", {
      workspaceId,
      documentId: doc.id,
      err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
    });
  }

  const mt = doc.mimeType.toLowerCase();
  if (mt.includes("pdf") || doc.originalName.toLowerCase().endsWith(".pdf")) {
    scheduleDocumentThumbnailWork(doc.id, { eagerBackground: true });
  }

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "document.reprocess",
      title: `Reprocessar documento: ${doc.originalName}`,
      metaJson: { documentId: doc.id, processId: doc.processId, caseId: doc.caseId },
    },
  });

  return NextResponse.json({ ok: true });
}
