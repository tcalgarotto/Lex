/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { NextResponse } from "next/server";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enforceDraftingRateLimit, loadCaseScoped } from "@/lib/cases/drafting/drafting-route-common";


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "strategy-approve",
  });
  if (limited) return limited;

  const c = await loadCaseScoped(workspaceId, id);
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  if (!meta["draftingStrategy"]) {
    return NextResponse.json(
      { error: "Gere a estratégia assistida antes de aprovar." },
      { status: 400 },
    );
  }

  const approved = { at: new Date().toISOString(), byUserId: user.id };
  const updated: Record<string, unknown> = {
    ...meta,
    draftingStrategyApproved: approved,
  };

  await prisma.case.update({
    where: { id: c.id },
    data: { metadataJson: updated as Prisma.InputJsonValue },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId: c.id,
      kind: CaseTimelineKind.STRATEGY_GENERATED,
      message: "Estratégia assistida (P0) aprovada para orientar peças.",
      userId: user.id,
      payloadJson: { mode: "draftingStrategyApproved" } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, draftingStrategyApproved: approved });
}
