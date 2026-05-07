import { NextResponse } from "next/server";
import { DocumentStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();

  const doc = await prisma.document.findFirst({ where: { id: documentId, workspaceId } });
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
      metaJson: { documentId: doc.id, processId: doc.processId },
    },
  });

  return NextResponse.json({ ok: true });
}

