/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { markPinnedFoundationVerified } from "@/lib/cases/case-brain/pinned-foundations";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pinnedId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, pinnedId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  let officialSourceUrl: string | undefined;
  try {
    const body = (await req.json()) as { officialSourceUrl?: string };
    if (typeof body?.officialSourceUrl === "string" && body.officialSourceUrl.trim()) {
      officialSourceUrl = body.officialSourceUrl.trim();
    }
  } catch {
    /* sem body */
  }
  try {
    const r = await markPinnedFoundationVerified(caseId, workspaceId, pinnedId, user.id, {
      officialSourceUrl,
    });
    return NextResponse.json(r);
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (st === 404) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    throw e;
  }
}
