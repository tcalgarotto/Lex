/**
 * POST /api/cases/[id]/brain
 *
 * Recomputa o Case Brain (idempotente via cache por hash). Use quando
 * o usuário quer forçar reconsolidação após editar dados.
 *
 * Pipeline: ver `src/lib/cases/brain.ts` — pré-extract + LLM + validador.
 */

import { NextResponse } from "next/server";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildCaseContext } from "@/lib/cases/context";
import { consolidateCaseBrain, persistBrainEntities } from "@/lib/cases/brain";
import { mergeCaseMetadataJson } from "@/lib/cases/case-brain/case-metadata-merge";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const ctx = await buildCaseContext({ workspaceId, caseId: id });
  if (!ctx) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta = (ctx.case.metadataJson ?? {}) as Record<string, unknown>;
  const checklistResponses =
    meta["brain"] && typeof meta["brain"] === "object"
      ? ((meta["brain"] as { checklistResponses?: unknown }).checklistResponses as
          | undefined
          | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string })
      : undefined;

  const result = await consolidateCaseBrain({
    rawInput: ctx.case.rawInput,
    documents: ctx.documents,
    pinnedSources: ctx.pinnedSources.map((s) => ({
      chunkId: s.chunkId,
      normUrn: s.normUrn,
      articleRef: s.articleRef,
      excerpt: s.excerpt,
    })),
    ...(checklistResponses ? { checklistResponses } : {}),
  });

  // Incrementa brainVersion contra a versão anterior, se existir.
  const previousBrainVersion =
    typeof meta["brainVersion"] === "number" ? (meta["brainVersion"] as number) : 0;
  const brain = { ...result.brain, brainVersion: previousBrainVersion + 1 };

  await prisma.$transaction(async (tx) => {
    const updatedMeta = mergeCaseMetadataJson(meta, {
      brain,
      brainVersion: brain.brainVersion,
    });
    await tx.case.update({
      where: { id: ctx.case.id },
      data: { metadataJson: updatedMeta as Prisma.InputJsonValue },
    });
    await persistBrainEntities({ caseId: ctx.case.id, brain, prisma: tx });
    await tx.caseTimelineEvent.create({
      data: {
        caseId: ctx.case.id,
        kind: CaseTimelineKind.BRAIN_GENERATED,
        message: `Inteligência do caso atualizada (v${brain.brainVersion}${result.cached ? " — cache" : ""}${brain.degraded ? " — modo degradado" : ""})`,
        userId: user.id,
        payloadJson: {
          brainVersion: brain.brainVersion,
          cached: result.cached,
          llmUsed: result.llmUsed,
          degraded: brain.degraded ?? false,
          partiesCount: brain.parties.length,
          factsCount: brain.facts.length,
          requestsCount: brain.requests.length,
          readinessScore: brain.proceduralReadiness.score,
          readinessStatus: brain.proceduralReadiness.status,
          warnings: result.warnings.slice(0, 10),
        },
      },
    });
  });

  return NextResponse.json(
    {
      brain,
      cached: result.cached,
      llmUsed: result.llmUsed,
      degraded: brain.degraded ?? false,
      warnings: result.warnings,
    },
    { status: 201 },
  );
}
