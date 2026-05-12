/**
 * POST /api/cases/[id]/strategy
 *
 * Sintetiza estratégia jurídica para o caso (tese, argumentos,
 * contra-argumentos, próximos passos, riscos) e persiste em
 * `Case.metadataJson.strategy` (sem migration — JSON livre).
 *
 * Resposta: 201 com o objeto `strategy` consolidado.
 *
 * Reaproveita `synthesizeStrategy` (determinístico, sem LLM no caminho
 * crítico) já usado por `/api/strategy/analyze`. Diferença: aqui o
 * resultado fica colado ao `Case` para a aba "Estratégia & Peças"
 * exibir inline sem o usuário sair do caso (F1 — embed).
 */

import { NextResponse } from "next/server";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/cases/repository";
import { detectContradictions } from "@/lib/legal/reasoning/contradiction";
import { spotLegalIssues } from "@/lib/legal/reasoning/issue-spotting";
import { synthesizeStrategy } from "@/lib/legal/reasoning/strategy";
import { retrieveLegalContext } from "@/lib/retrieval/legal";
import { listPinnedJurisprudenceCandidates } from "@/lib/cases/drafting/case-brain-shim";


/**
 * GET /api/cases/[id]/strategy
 *
 * Retorna estratégia legada (`metadataJson.strategy`), estratégia P0
 * (`metadataJson.draftingStrategy`), flag de aprovação e prontidão do caso.
 */
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

/**
 * GET /api/cases/[id]/strategy
 *
 * Retorna estratégia legada (`metadataJson.strategy`), estratégia P0
 * (`metadataJson.draftingStrategy`), flag de aprovação e prontidão do caso.
 */
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const c = await getCaseById(workspaceId, id);
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const querySources = [
    c.summary ?? c.title,
    ...c.facts.slice(0, 4).map((f) => f.text),
    ...c.requests.slice(0, 3).map((r) => r.text),
  ].filter((s): s is string => !!s && s.length > 0);
  const query = querySources.join(" ").slice(0, 1500) || c.title;

  const filters: Parameters<typeof retrieveLegalContext>[1] = {
    topK: 12,
    workspaceId,
    useCache: true,
  };
  if (c.tribunalCode) {
    filters.filters = { tribunals: [c.tribunalCode] };
  }
  const retrieval = await retrieveLegalContext(query, filters);

  const issues = spotLegalIssues({
    query,
    intent: retrieval.intent,
    chunks: retrieval.chunks,
  });
  const risks = await detectContradictions({
    chunks: retrieval.chunks,
    intent: retrieval.intent,
    ...(retrieval.intent.asOf ? { asOf: retrieval.intent.asOf } : {}),
  });
  const strategy = synthesizeStrategy({
    query,
    intent: retrieval.intent,
    chunks: retrieval.chunks,
    risks,
    issues,
  });

  const existingMeta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const updatedMeta: Record<string, unknown> = {
    ...existingMeta,
    strategy: {
      ...strategy,
      generatedAt: new Date().toISOString(),
      generatedBy: user.id,
      query,
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
      message: `Estratégia gerada: ${strategy.thesis.slice(0, 120)}`,
      userId: user.id,
      retrievalChunkIds: retrieval.chunks.map((ch) => ch.chunkId),
      payloadJson: {
        argumentsCount: strategy.arguments.length,
        nextStepsCount: strategy.nextSteps.length,
        risksCount: risks.length,
        issuesCount: issues.length,
      },
    },
  });

  return NextResponse.json({ strategy }, { status: 201 });
}
