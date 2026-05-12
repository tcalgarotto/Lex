/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { persistReview } from "@/lib/cases/repository";
import { reviewDraft } from "@/lib/cases/review/review-draft";
import { enforceDraftingRateLimit } from "@/lib/cases/drafting/drafting-route-common";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-review",
  });
  if (limited) return limited;

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const draft = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
  });
  if (!draft) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  const result = await reviewDraft(draft.id, workspaceId, draft.content);

  const checklist = result.issues.map((i) => ({
    id: i.id,
    severity: i.severity,
    message: i.message,
    hint: i.hint ?? null,
  }));

  const persisted = await persistReview({
    workspaceId,
    caseId,
    score: result.score,
    verdict: result.verdict,
    checklist,
    userId: user.id,
  });

  return NextResponse.json({ review: persisted, issues: result.issues });
}
