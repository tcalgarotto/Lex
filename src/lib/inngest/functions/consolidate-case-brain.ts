/**
 * F2 — Worker Inngest que recomputa o Case Brain.
 *
 * Disparado por:
 *   - `lex/case.brain` após criar caso, indexar documento, salvar checklist
 *     ou clique manual em "Recomputar".
 *
 * Idempotente: `consolidateCaseBrain` faz cache por hash do input + checklist.
 * Se nada mudou, devolve o brain cacheado em milissegundos.
 */

import { NonRetriableError } from "inngest";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { consolidateCaseBrain, persistBrainEntities } from "@/lib/cases/brain";
import { mergeCaseMetadataJson } from "@/lib/cases/case-brain/case-metadata-merge";

export const consolidateCaseBrainFn = inngest.createFunction(
  { id: "consolidate-case-brain", retries: 2 },
  { event: "lex/case.brain" },
  async ({ event, step }) => {
    const { caseId, source } = event.data;

    const ctx = await step.run("load-case", async () => {
      const c = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          documents: {
            select: { id: true, originalName: true, extractedText: true },
          },
          legalSources: {
            select: {
              chunkId: true,
              normUrn: true,
              articleRef: true,
              excerpt: true,
            },
          },
        },
      });
      if (!c) throw new NonRetriableError("Caso não encontrado");
      return c;
    });

    const meta = (ctx.metadataJson ?? {}) as Record<string, unknown>;
    const checklistResponses = readChecklist(meta);
    const previousVersion =
      typeof meta["brainVersion"] === "number" ? (meta["brainVersion"] as number) : 0;

    const result = await step.run("consolidate", () =>
      consolidateCaseBrain({
        rawInput: ctx.rawInput,
        documents: ctx.documents.map((d) => ({
          id: d.id,
          originalName: d.originalName,
          text: (d.extractedText ?? "").slice(0, 60_000),
        })),
        pinnedSources: ctx.legalSources.map((s) => ({
          chunkId: s.chunkId,
          normUrn: s.normUrn,
          articleRef: s.articleRef,
          excerpt: s.excerpt,
        })),
        ...(checklistResponses ? { checklistResponses } : {}),
      }),
    );

    const brain = { ...result.brain, brainVersion: previousVersion + 1 };

    await step.run("persist", async () => {
      await prisma.$transaction(async (tx) => {
        const updatedMeta = mergeCaseMetadataJson(meta, {
          brain,
          brainVersion: brain.brainVersion,
        });
        await tx.case.update({
          where: { id: caseId },
          data: { metadataJson: updatedMeta as Prisma.InputJsonValue },
        });
        await persistBrainEntities({ caseId, brain, prisma: tx });
        await tx.caseTimelineEvent.create({
          data: {
            caseId,
            kind: CaseTimelineKind.BRAIN_GENERATED,
            message: `Inteligência do caso atualizada (v${brain.brainVersion}${result.cached ? " — cache" : ""}${brain.degraded ? " — modo degradado" : ""})`,
            payloadJson: {
              brainVersion: brain.brainVersion,
              source: source ?? "manual",
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
    });

    return {
      ok: true,
      caseId,
      brainVersion: brain.brainVersion,
      cached: result.cached,
      llmUsed: result.llmUsed,
      degraded: brain.degraded ?? false,
    };
  },
);

function readChecklist(
  meta: Record<string, unknown>,
):
  | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string }
  | undefined {
  const b = meta["brain"];
  if (!b || typeof b !== "object") return undefined;
  const x = (b as { checklistResponses?: unknown }).checklistResponses;
  if (!x || typeof x !== "object") return undefined;
  const c = x as {
    templateId?: unknown;
    version?: unknown;
    answers?: unknown;
    answeredAt?: unknown;
  };
  if (
    typeof c.templateId !== "string" ||
    typeof c.version !== "number" ||
    !c.answers ||
    typeof c.answers !== "object" ||
    typeof c.answeredAt !== "string"
  ) {
    return undefined;
  }
  return {
    templateId: c.templateId,
    version: c.version,
    answers: c.answers as Record<string, unknown>,
    answeredAt: c.answeredAt,
  };
}
