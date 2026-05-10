/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { removePinnedFoundation } from "@/lib/cases/case-brain/pinned-foundations";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pinnedId: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId, pinnedId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  try {
    await removePinnedFoundation(caseId, workspaceId, pinnedId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (st === 404) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    throw e;
  }
}
