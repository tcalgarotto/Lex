/**
 * Consolida Case Brain e persiste em `metadataJson` + entidades (fatos, partes, etc.).
 * Usado pelo POST /api/cases/[id]/brain e após salvar checklist (demo sem worker Inngest).
 */

import { CaseTimelineKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCaseContext } from "@/lib/cases/context";
import { consolidateCaseBrain, persistBrainEntities } from "@/lib/cases/brain";
import { mergeCaseMetadataJson } from "@/lib/cases/case-brain/case-metadata-merge";
import type { CaseBrain } from "@/lib/cases/brain-types";

export type ReconcileCaseBrainSuccess = {
  brain: CaseBrain;
  cached: boolean;
  llmUsed: boolean;
  degraded: boolean;
  warnings: string[];
};

/**
 * @throws Se o caso não existir no workspace ou falhar a transação.
 */
export async function reconcileCaseBrainFromWorkspaceCase(args: {
  workspaceId: string;
  caseId: string;
  userId: string;
}): Promise<ReconcileCaseBrainSuccess> {
  const ctx = await buildCaseContext({ workspaceId: args.workspaceId, caseId: args.caseId });
  if (!ctx) {
    throw new Error("Caso não encontrado");
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
        userId: args.userId,
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

  return {
    brain,
    cached: result.cached,
    llmUsed: result.llmUsed,
    degraded: brain.degraded ?? false,
    warnings: result.warnings,
  };
}
