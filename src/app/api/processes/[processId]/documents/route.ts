import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  context: { params: Promise<{ processId: string }> },
) {
  const { processId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();

  const proc = await prisma.process.findFirst({
    where: { id: processId, workspaceId },
    select: { id: true },
  });
  if (!proc) {
    return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  }

  const docs = await prisma.document.findMany({
    where: { workspaceId, processId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      errorMessage: true,
      progress: true,
      totalChunks: true,
      processedChunks: true,
      indexedAt: true,
      extractedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ documents: docs });
}

