import { NextResponse } from "next/server";
import { DocumentStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";

/**
 * Reprocessar um documento:
 *  1. Verifica que o documento existe e pertence ao workspace do usuário.
 *  2. Reseta os campos do pipeline (`status=UPLOADED`, progress, contadores).
 *  3. Apaga `DocumentChunk` antigos no Postgres (cascade-friendly).
 *  4. Apaga pontos no Qdrant — **somente** na collection `lex_main`, com
 *     filtro estrito por `documentId` E `workspaceId`. Nunca toca em
 *     `lex_corpus_norms` / `lex_corpus_jurisprudence` (corpus oficial).
 *  5. Reenfileira o evento Inngest `lex/document.ingest`.
 *  6. Registra `Activity kind=document.reprocess`.
 *
 * Em caso de falha na limpeza Qdrant, mantemos o reprocess seguindo
 * (ingest reescreverá os pontos com mesmos `chunkIndex`).
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
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
    await getQdrantVectorStore().deleteByDocumentId(doc.id, doc.workspaceId);
  } catch (err) {
    console.error("[reprocess] Qdrant delete falhou (não-fatal)", {
      documentId: doc.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await inngest.send({ name: "lex/document.ingest", data: { documentId: doc.id } });
  } catch (e) {
    console.error("Inngest send failed", e);
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
