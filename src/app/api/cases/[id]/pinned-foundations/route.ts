/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { addPinnedFoundationToCase, listPinnedFoundations } from "@/lib/cases/case-brain/pinned-foundations";
import type { JurisprudenceCandidate, LegalFoundationCandidate } from "@/lib/legal-research/types";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  candidate: z.record(z.unknown()),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const list = await listPinnedFoundations(caseId, workspaceId);
  return NextResponse.json({ pinnedFoundations: list });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const candidate = body.candidate as unknown as LegalFoundationCandidate | JurisprudenceCandidate;
  if (!candidate || typeof candidate.id !== "string") {
    return NextResponse.json({ error: "candidate inválido" }, { status: 400 });
  }
  try {
    const r = await addPinnedFoundationToCase(caseId, workspaceId, candidate, user.id);
    return NextResponse.json(r, { status: r.status === "pinned" ? 201 : 200 });
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (st === 404) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    throw e;
  }
}
