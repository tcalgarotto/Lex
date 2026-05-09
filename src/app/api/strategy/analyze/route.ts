/**
 * GET /api/strategy/analyze — Research Engine + Strategic Reasoning + Explainability
 * em uma única resposta auditável (para copiloto operacional).
 *
 * Query: q (obrigatório), tribunals (csv), uf (expande TJ/TRF regional), caseId (fatos para lacunas).
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/cases/repository";
import { primaryRegionalForUf } from "@/lib/corpus/tribunals/registry";
import { detectContradictions } from "@/lib/legal/reasoning/contradiction";
import { buildReasoningTree } from "@/lib/legal/reasoning/explain-tree";
import { spotLegalIssues } from "@/lib/legal/reasoning/issue-spotting";
import { buildStrategicAssessment } from "@/lib/legal/reasoning/strategic";
import { synthesizeStrategy } from "@/lib/legal/reasoning/strategy";
import { buildTimelines } from "@/lib/legal/reasoning/timeline";
import { retrieveLegalContext } from "@/lib/retrieval/legal";
import type { LegalRetrievalFilters } from "@/lib/retrieval/legal/types";
import { buildResearchReport } from "@/lib/research/engine";
import { WINNING_SAMPLE_KIND } from "@/lib/lawyer-brain/ingest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requirePermission("observabilityView");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Permissão insuficiente")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { workspaceId, user } = await getWorkspaceContext();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ error: "query muito curta" }, { status: 400 });
  }

  const tribunalsParam = url.searchParams.get("tribunals");
  const uf = url.searchParams.get("uf")?.toUpperCase();
  const caseId = url.searchParams.get("caseId");

  let factTexts: string[] = [];
  let targetTribunal: string | null = null;

  if (caseId) {
    const c = await getCaseById(workspaceId, caseId);
    if (c) {
      factTexts = c.facts.map((f) => f.text);
      targetTribunal = c.tribunalCode ?? null;
    }
  }

  const filters: LegalRetrievalFilters = {};
  const tribSet = new Set<string>();
  if (tribunalsParam) {
    for (const t of tribunalsParam.split(",")) {
      const x = t.trim().toUpperCase();
      if (x) tribSet.add(x);
    }
  }
  if (uf && uf.length === 2) {
    const { tj, trf } = primaryRegionalForUf(uf);
    if (tj?.code) tribSet.add(tj.code);
    if (trf?.code) tribSet.add(trf.code);
  }
  if (tribSet.size > 0) filters.tribunals = [...tribSet];
  if (!targetTribunal && filters.tribunals?.length) {
    targetTribunal = filters.tribunals[0]!;
  }

  const retrieval = await retrieveLegalContext(q, {
    workspaceId,
    topK: 14,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
  });

  const issues = spotLegalIssues({
    query: q,
    intent: retrieval.intent,
    chunks: retrieval.chunks,
  });

  const risks = await detectContradictions({
    chunks: retrieval.chunks,
    intent: retrieval.intent,
    ...(retrieval.intent.asOf ? { asOf: retrieval.intent.asOf } : {}),
  });

  const timelines = await buildTimelines({
    normIds: Array.from(new Set(retrieval.chunks.map((c) => c.norm.id))),
    ...(retrieval.intent.asOf ? { asOf: retrieval.intent.asOf } : {}),
  });

  const strategy = synthesizeStrategy({
    query: q,
    intent: retrieval.intent,
    chunks: retrieval.chunks,
    risks,
    issues,
  });

  const research = buildResearchReport({
    chunks: retrieval.chunks,
    filters: retrieval.filters,
    contradictions: risks,
  });

  const strategic = buildStrategicAssessment({
    intent: retrieval.intent,
    chunks: retrieval.chunks,
    risks,
    issues,
    strategy,
    factTexts,
    targetTribunal,
  });

  const reasoningTree = buildReasoningTree({
    query: q,
    intent: retrieval.intent,
    trace: retrieval.trace,
    issues,
    risks,
    strategy,
  });

  const styleProfile = await prisma.styleProfile.findFirst({
    where: { workspaceId, userId: user.id },
  });

  const lawyerBrain =
    styleProfile?.profileJson &&
    typeof styleProfile.profileJson === "object" &&
    styleProfile.profileJson !== null &&
    "lawyerBrain" in styleProfile.profileJson
      ? (styleProfile.profileJson as { lawyerBrain?: unknown }).lawyerBrain
      : null;

  const officeMemory = await prisma.memoryEntry.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, kind: true, title: true, content: true, updatedAt: true },
  });

  const winningSamples = await prisma.legalPiece.count({
    where: { workspaceId, kind: WINNING_SAMPLE_KIND },
  });

  return NextResponse.json({
    retrieval,
    reasoning: { issues, risks, timelines, strategy },
    research,
    strategic,
    explainability: {
      reasoningTree,
      timelineIntelligence: timelines,
    },
    lawyerBrain,
    officeMemory,
    winningSamplesCount: winningSamples,
  });
}
