import { NextResponse } from "next/server";
import { CaseTimelineKind } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { removeDocumentBuffer } from "@/lib/storage";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.documents.id");

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId },
    include: {
      chunks: { orderBy: { chunkIndex: "asc" }, take: 200 },
      process: { select: { id: true, number: true, title: true } },
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      processId: doc.processId,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      errorMessage: doc.errorMessage,
      progress: doc.progress,
      totalChunks: doc.totalChunks,
      processedChunks: doc.processedChunks,
      extractedAt: doc.extractedAt,
      indexedAt: doc.indexedAt,
      extractedText: doc.extractedText ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      process: doc.process,
    },
    chunks: doc.chunks.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      section: c.section,
      contentHash: c.contentHash,
      tokenEstimate: c.tokenEstimate,
      qdrantPointId: c.qdrantPointId,
      textPreview: c.textPreview,
      text: c.text,
      createdAt: c.createdAt,
    })),
  });
}

/**
 * DELETE /api/documents/[documentId]
 *
 * Remove definitivamente o documento:
 *  1. Verifica escopo workspace (multi-tenant).
 *  2. Apaga pontos no Qdrant (lex_main filtrado por documentId+workspaceId).
 *  3. Apaga objeto no Supabase Storage (best-effort).
 *  4. Apaga `Document` no Postgres (cascade limpa `DocumentChunk`).
 *  5. Registra `Activity` + `CaseTimelineEvent` (NOTE) se vinculado a caso.
 *
 * Retorna `{ ok: true }` em sucesso.
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId },
    select: {
      id: true,
      workspaceId: true,
      caseId: true,
      processId: true,
      originalName: true,
      storagePath: true,
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
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
    await removeDocumentBuffer(doc.storagePath);
  } catch (err) {
    log.warn("storage remove failed (non-fatal)", {
      workspaceId,
      documentId: doc.id,
      err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
    });
  }

  await prisma.document.delete({ where: { id: doc.id } });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "document.deleted",
      title: `Documento excluído: ${doc.originalName}`,
      metaJson: {
        documentId: doc.id,
        processId: doc.processId,
        caseId: doc.caseId,
        deletedBy: user.id,
      },
    },
  });

  if (doc.caseId) {
    await prisma.caseTimelineEvent.create({
      data: {
        caseId: doc.caseId,
        kind: CaseTimelineKind.NOTE,
        message: `Documento removido do caso: ${doc.originalName}`,
        userId: user.id,
        payloadJson: { action: "document.deleted", documentId: doc.id },
      },
    });
  }

  return NextResponse.json({ ok: true });
}

