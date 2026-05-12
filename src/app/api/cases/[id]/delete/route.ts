import { NextResponse } from "next/server";
import { CaseTimelineKind } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { removeDocumentBuffer, removeDocumentThumbnails } from "@/lib/storage";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { getLogger } from "@/lib/logger";


const log = getLogger("lex.api.cases.delete");

/**
 * DELETE /api/cases/[id]/delete?confirm=1
 *
 * Excluir definitivo de caso:
 * - Valida workspaceId (anti-IDOR).
 * - Remove documentos vinculados (Qdrant + Storage best-effort).
 * - Remove registros do caso (cascade nas tabelas relacionadas).
 * - Registra Activity + CaseTimelineEvent (NOTE).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  const url = new URL(req.url);
  if (url.searchParams.get("confirm") !== "1") {
    return NextResponse.json(
      { error: "Confirmação obrigatória. Reenvie com ?confirm=1" },
      { status: 400 },
    );
  }

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true, title: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const docs = await prisma.document.findMany({
    where: { workspaceId, caseId },
    select: { id: true, workspaceId: true, storagePath: true, originalName: true },
    take: 500,
  });

  for (const d of docs) {
    try {
      await getQdrantVectorStore().deleteByDocumentId(d.id, d.workspaceId);
    } catch (err) {
      log.warn("qdrant delete failed (non-fatal)", {
        workspaceId,
        caseId,
        documentId: d.id,
        err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
      });
    }
    try {
      await removeDocumentBuffer(d.storagePath);
      await removeDocumentThumbnails(d.workspaceId, d.id);
    } catch (err) {
      log.warn("storage remove failed (non-fatal)", {
        workspaceId,
        caseId,
        documentId: d.id,
        err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
      });
    }
  }

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: CaseTimelineKind.NOTE,
      message: "Exclusão definitiva solicitada. Caso removido.",
      userId: user.id,
      payloadJson: { action: "case.deleted", deletedDocumentIds: docs.map((d) => d.id) },
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "case.deleted",
      title: `Caso excluído: ${c.title}`,
      metaJson: {
        caseId,
        deletedBy: user.id,
        deletedDocumentIds: docs.map((d) => d.id),
      },
    },
  });

  await prisma.case.delete({ where: { id: caseId } });

  return NextResponse.json({ ok: true });
}

