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
import { generateStrategy } from "@/lib/cases/drafting/generate-strategy";
import {
  enforceDraftingRateLimit,
  loadCaseScoped,
} from "@/lib/cases/drafting/drafting-route-common";


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "strategy-generate",
  });
  if (limited) return limited;

  const c = await loadCaseScoped(workspaceId, id);
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  try {
    const draftingStrategy = await generateStrategy(id, workspaceId);
    const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
    const updated: Record<string, unknown> = {
      ...meta,
      draftingStrategy,
      draftingStrategyApproved: null,
    };

    await prisma.case.update({
      where: { id: c.id },
      data: { metadataJson: updated as Prisma.InputJsonValue },
    });

    await prisma.caseTimelineEvent.create({
      data: {
        caseId: c.id,
        kind: CaseTimelineKind.STRATEGY_GENERATED,
        message: `Estratégia assistida (P0) atualizada: ${(draftingStrategy.theses[0] ?? "sem tese").slice(0, 120)}`,
        userId: user.id,
        payloadJson: {
          mode: "draftingStrategy",
          thesesCount: draftingStrategy.theses.length,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ draftingStrategy }, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
