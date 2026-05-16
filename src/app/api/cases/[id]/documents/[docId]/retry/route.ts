/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { DocumentStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { recordCaseMutationActivity } from "@/lib/cases/case-brain/activity-log";


export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, docId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const d = await prisma.document.findFirst({
    where: { id: docId, caseId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!d) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  await prisma.document.update({
    where: { id: docId },
    data: {
      status: DocumentStatus.UPLOADED,
      errorMessage: null,
      progress: 0,
    },
  });
  try {
    await inngest.send({
      name: "lex/document.ingest",
      data: { documentId: docId, workspaceId },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível enfileirar nova tentativa." }, { status: 503 });
  }
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.document.retry",
    title: "Nova tentativa de leitura do documento",
    meta: { caseId, documentId: docId },
  });
  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: "Nova tentativa de leitura do documento enfileirada.",
      payloadJson: { documentId: docId, action: "document.retry" },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });
  return NextResponse.json({ ok: true, documentId: docId, uiStatus: "PROCESSING" });
}
