import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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

