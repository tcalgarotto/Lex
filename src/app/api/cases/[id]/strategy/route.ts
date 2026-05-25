/**
 * GET/POST /api/cases/[id]/strategy
 *
 * GET — estratégia legada, estratégia P0 (`draftingStrategy`), aprovação e prontidão.
 * POST — gera `draftingStrategy` via DeepSeek e persiste em `metadataJson`.
 */

import { NextResponse } from "next/server";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import {
  scheduleLangfuseFlush,
  withLangfuseRouteContext,
} from "@/lib/observability/langfuse-tracing";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/cases/repository";
import { listPinnedJurisprudenceCandidates } from "@/lib/cases/drafting/case-brain-shim";
import { generateStrategy } from "@/lib/cases/drafting/generate-strategy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;

  const row = await prisma.case.findFirst({
    where: { id, workspaceId },
    select: { metadataJson: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta = (row.metadataJson ?? {}) as Record<string, unknown>;
  const readiness =
    meta["brain"] &&
    typeof meta["brain"] === "object" &&
    (meta["brain"] as { proceduralReadiness?: unknown }).proceduralReadiness
      ? (meta["brain"] as { proceduralReadiness: unknown }).proceduralReadiness
      : null;

  const jurisprudenceCandidates = await listPinnedJurisprudenceCandidates(workspaceId, id);

  return NextResponse.json({
    legacyStrategy: meta["strategy"] ?? null,
    draftingStrategy: meta["draftingStrategy"] ?? null,
    approved: Boolean(meta["draftingStrategyApproved"]),
    draftingStrategyApproved: meta["draftingStrategyApproved"] ?? null,
    readiness,
    jurisprudenceCandidates,
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const c = await getCaseById(workspaceId, id);
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  try {
    scheduleLangfuseFlush();

    const draftingStrategy = await withLangfuseRouteContext(
      {
        traceName: "strategy-generation",
        userId: user.id,
        workspaceId,
        caseId: id,
        inputSummary: JSON.stringify({ caseId: id }),
      },
      () => generateStrategy(id, workspaceId),
    );
    const existingMeta = (c.metadataJson ?? {}) as Record<string, unknown>;
    const fundLines =
      draftingStrategy.suggestedLegalFoundations?.length
        ? draftingStrategy.suggestedLegalFoundations
        : draftingStrategy.relatedFoundations;
    const thesisLine = draftingStrategy.mainThesis ?? draftingStrategy.theses[0] ?? "";
    const updatedMeta: Record<string, unknown> = {
      ...existingMeta,
      draftingStrategy,
      draftingStrategyApproved: null,
      strategy: {
        thesis: thesisLine,
        arguments: fundLines.map((t: string, i: number) => ({
          id: `arg-${i}`,
          headline: t,
          excerpt: "",
          evidence: { chunkIds: [] as string[], normUrns: [] as string[] },
          weight: 0.5,
        })),
        counterArguments: [],
        nextSteps: draftingStrategy.recommendedActions ?? [],
        badge: "deepseek-strategy",
        generatedAt: new Date().toISOString(),
        generatedBy: user.id,
      },
    };

    await prisma.case.update({
      where: { id: c.id },
      data: { metadataJson: updatedMeta as Prisma.InputJsonValue },
    });

    await prisma.caseTimelineEvent.create({
      data: {
        caseId: c.id,
        kind: CaseTimelineKind.STRATEGY_GENERATED,
        message: `Estratégia assistida (JustOS AI): ${(draftingStrategy.mainThesis ?? draftingStrategy.theses[0] ?? "atualizada").slice(0, 120)}`,
        userId: user.id,
        retrievalChunkIds: [],
        payloadJson: {
          mode: "draftingStrategy",
          thesesCount: draftingStrategy.theses.length,
          provider: "deepseek",
        },
      },
    });

    return NextResponse.json({ strategy: updatedMeta["strategy"], draftingStrategy }, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
