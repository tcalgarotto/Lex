/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getCaseBrainSnapshot } from "@/lib/cases/case-brain/snapshot";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId } = await params;
  const snap = await getCaseBrainSnapshot(caseId, workspaceId);
  if (!snap) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  return NextResponse.json(snap);
}
