/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId, docId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const d = await prisma.document.findFirst({
    where: { id: docId, caseId, workspaceId, deletedAt: null },
    select: { extractedText: true, originalName: true, status: true, errorMessage: true },
  });
  if (!d) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    text: d.extractedText ?? "",
    originalName: d.originalName,
    status: d.status,
    errorMessage: d.errorMessage,
  });
}
