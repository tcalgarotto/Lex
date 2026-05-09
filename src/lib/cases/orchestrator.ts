/**
 * Orquestrador da camada Legal Workflow Automation.
 *
 * Conecta os módulos individuais — intake / retrieval / drafting / review —
 * em workflows operacionais que a UI chama via API:
 *
 *   - createCase(rawInput): roda intake + persiste Case + persiste timeline.
 *   - generateDraft(caseId): retrieval + reasoning + drafting + persiste minuta + risks.
 *   - reviewCase(caseId): roda review e persiste resultado.
 *
 * Cada workflow é multi-tenant (sempre exige workspaceId) e gera trace.
 * Riscos detectados são automaticamente convertidos em CaseRisk persistidos.
 */

import {
  CaseRiskKind,
  CaseRiskSeverity,
  CaseStatus,
  type CaseDraft,
  type CaseReview,
} from "@prisma/client";
import { detectContradictions, type ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import { spotLegalIssues } from "@/lib/legal/reasoning/issue-spotting";
import { synthesizeStrategy } from "@/lib/legal/reasoning/strategy";
import { retrieveLegalContext } from "@/lib/retrieval/legal";
import { buildApprovedLegalFoundation, validateLegalGrounding } from "@/lib/retrieval/legal/approved-foundation";
import { getCorpusManifest } from "@/lib/corpus/manifest";
import { runIntake } from "./intake";
import {
  appendTimelineEvent,
  createCaseFromIntake,
  getCaseById,
  persistDraft,
  persistReview,
  persistRisks,
  setCaseStatus,
} from "./repository";
import { buildDraft } from "./drafting";
import { buildCaseContext } from "./context";
import { runReview } from "./review";
import type { ParsedRisk } from "./types";

/* --------------------------- create case ------------------------------- */

export async function intakeWorkflow(args: {
  workspaceId: string;
  userId: string;
  rawInput: string;
}) {
  const intake = runIntake(args.rawInput);
  const c = await createCaseFromIntake({
    workspaceId: args.workspaceId,
    createdById: args.userId,
    rawInput: args.rawInput,
    intake,
  });
  return { case: c, intake };
}

/* --------------------------- draft workflow ---------------------------- */

export async function draftWorkflow(args: {
  workspaceId: string;
  userId: string;
  caseId: string;
}): Promise<{
  draft: CaseDraft;
  chunkIds: string[];
  verdict: string;
  lacunas: string[];
  unindexedFoundations: Array<{ urn?: string; label: string; suggestedUse?: string }>;
  usedBrain: boolean;
  usedPinnedSources: number;
}> {
  // F4 — buildCaseContext centraliza joins, brain, pinned sources, documentos.
  const ctx = await buildCaseContext({ workspaceId: args.workspaceId, caseId: args.caseId });
  if (!ctx) {
    const err = new Error("Caso não encontrado neste workspace.");
    (err as { status?: number }).status = 404;
    throw err;
  }
  const c = ctx.case;

  // Query montada deterministicamente — privilegia brain.problem/objective
  // quando disponível; cai para summary/facts/requests caso contrário.
  const querySources = ctx.brain
    ? [
        ctx.brain.problem,
        ctx.brain.objective,
        ctx.brain.thesis,
        ...ctx.brain.facts.slice(0, 4).map((f) => f.text),
        ...ctx.brain.requests.slice(0, 3).map((r) => r.text),
      ].filter((s): s is string => !!s && s.length > 0)
    : [
        c.summary ?? c.title,
        ...ctx.facts.slice(0, 4).map((f) => f.text),
        ...ctx.requests.slice(0, 3).map((r) => r.text),
      ].filter((s): s is string => !!s && s.length > 0);
  const query = querySources.join(" ").slice(0, 1500);

  await appendTimelineEvent({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    kind: "RESEARCH_RUN",
    message: "Pesquisa jurídica automática iniciada (acervo indexado)",
    payloadJson: { source: "draft" },
    userId: args.userId,
  });

  // F4 — pinnedSources viram mustInclude no retrieval.
  const mustNormUrns = Array.from(
    new Set(
      ctx.pinnedSources
        .map((s) => s.normUrn)
        .filter((u): u is string => !!u),
    ),
  );
  const mustChunkIds = Array.from(
    new Set(
      ctx.pinnedSources
        .map((s) => s.chunkId)
        .filter((id): id is string => !!id),
    ),
  );

  const filters: Parameters<typeof retrieveLegalContext>[1] = {
    topK: 12,
    workspaceId: args.workspaceId,
    useCache: true,
  };
  const corpusFilters: NonNullable<Parameters<typeof retrieveLegalContext>[1]>["filters"] = {};
  if (c.tribunalCode) corpusFilters.tribunals = [c.tribunalCode];
  if (Object.keys(corpusFilters).length > 0) filters.filters = corpusFilters;
  if (mustNormUrns.length > 0 || mustChunkIds.length > 0) {
    filters.mustInclude = {
      ...(mustNormUrns.length > 0 ? { normUrns: mustNormUrns } : {}),
      ...(mustChunkIds.length > 0 ? { chunkIds: mustChunkIds } : {}),
    };
  }
  if (ctx.brain) {
    filters.caseContext = {
      area: ctx.brain.area,
      ...(ctx.brain.problem ? { problem: ctx.brain.problem } : {}),
    };
  }
  const retrieval = await retrieveLegalContext(query, filters);
  // F7.2 — valida grounding e deriva fundamentos aprovados para drafting.
  const _grounding = validateLegalGrounding(retrieval);
  const foundations = buildApprovedLegalFoundation({
    chunks: retrieval.chunks,
    audience: "admin",
    limit: filters.topK ?? 8,
  });

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

  // Persiste riscos como CaseRisk antes do draft
  const parsedRisks = mapContradictionToCaseRisks(risks);
  if (parsedRisks.length) {
    await persistRisks({ workspaceId: args.workspaceId, caseId: args.caseId, risks: parsedRisks });
  }

  const corpusManifest = await getCorpusManifest();

  const draftBundle = buildDraft({
    case: c,
    facts: ctx.facts,
    parties: ctx.parties,
    requests: ctx.requests,
    foundations,
    strategy,
    brain: ctx.brain,
    pinnedSources: ctx.pinnedSources,
    documents: c.documents.map((d) => ({ originalName: d.originalName })),
    corpusManifest,
  });

  const draft = await persistDraft({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    content: draftBundle.content,
    groundingChunkIds: draftBundle.groundingChunkIds,
    userId: args.userId,
    metadata: {
      sections: draftBundle.sections,
      groundingScore: retrieval.groundingScore,
      confidence: retrieval.confidence,
      groundingOk: _grounding.ok,
      groundingGaps: _grounding.gaps,
      query,
      issuesCount: issues.length,
      risksCount: risks.length,
      lacunas: draftBundle.lacunas,
      unindexedFoundations: draftBundle.unindexedFoundations,
      usedBrainContext: draftBundle.usedBrainContext,
      usedPinnedSources: draftBundle.usedPinnedSources,
      brainVersion: ctx.brain?.brainVersion ?? null,
    },
  });

  if (c.status === CaseStatus.INTAKE || c.status === CaseStatus.RESEARCH) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.DRAFTING, args.userId);
  }

  return {
    draft,
    chunkIds: draftBundle.groundingChunkIds,
    verdict: retrieval.confidence.label,
    lacunas: draftBundle.lacunas,
    unindexedFoundations: draftBundle.unindexedFoundations,
    usedBrain: draftBundle.usedBrainContext,
    usedPinnedSources: draftBundle.usedPinnedSources,
  };
}

/* --------------------------- review workflow --------------------------- */

export async function reviewWorkflow(args: {
  workspaceId: string;
  userId: string;
  caseId: string;
}): Promise<{ review: CaseReview; checklist: ReturnType<typeof runReview>["items"] }> {
  const c = await getCaseById(args.workspaceId, args.caseId);
  if (!c) {
    const err = new Error("Caso não encontrado neste workspace.");
    (err as { status?: number }).status = 404;
    throw err;
  }
  const lastDraft = c.drafts[0];
  if (!lastDraft) {
    const err = new Error("Não há minuta para revisar — gere um draft antes.");
    (err as { status?: number }).status = 400;
    throw err;
  }

  const query = c.summary ?? c.title;
  const retrieval = await retrieveLegalContext(query, {
    topK: 8,
    workspaceId: args.workspaceId,
    useCache: true,
  });
  const issues = spotLegalIssues({ query, intent: retrieval.intent, chunks: retrieval.chunks });
  const risks = await detectContradictions({ chunks: retrieval.chunks, intent: retrieval.intent });

  const inconsistencyRisksCount = c.risks.filter(
    (r) => r.kind === "DOCUMENT_INCONSISTENCY" && !r.resolvedAt,
  ).length;
  const pinnedChunkIds = (c.legalSources ?? [])
    .map((s) => s.chunkId)
    .filter((id): id is string => !!id);
  const draftMeta = (lastDraft.metadataJson ?? {}) as Record<string, unknown>;
  const draftUsedBrain = Boolean(draftMeta["usedBrainContext"]);

  const result = runReview({
    draftContent: lastDraft.content,
    groundingChunkIds: lastDraft.groundingChunkIds,
    facts: c.facts,
    parties: c.parties,
    requests: c.requests,
    risks,
    issues,
    pinnedChunkIds,
    inconsistencyRisksCount,
    draftUsedBrain,
  });

  const review = await persistReview({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    score: result.score,
    verdict: result.verdict,
    checklist: result.items as unknown as Array<Record<string, unknown>>,
    userId: args.userId,
  });

  // F6 — só promove READY quando o verdict explicitamente diz "Pronta para
  // protocolo" (sem warnings, score >= 0.9, sem fails). Caso contrário,
  // mantém em REVIEW para o advogado decidir.
  if (result.verdict === "Pronta para protocolo" && c.status === CaseStatus.DRAFTING) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.READY, args.userId);
  } else if (c.status !== CaseStatus.REVIEW) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.REVIEW, args.userId);
  }

  return { review, checklist: result.items };
}

/* --------------------------- helpers ----------------------------------- */

export function mapContradictionToCaseRisks(risks: ContradictionRisk[]): ParsedRisk[] {
  const SEVERITY: Record<string, CaseRiskSeverity> = {
    alta: CaseRiskSeverity.HIGH,
    media: CaseRiskSeverity.MEDIUM,
    baixa: CaseRiskSeverity.LOW,
  };

  return risks.map((r) => {
    const lc = `${r.title} ${r.detail}`.toLowerCase();
    let kind: CaseRiskKind = CaseRiskKind.OTHER;
    if (/revogad/.test(lc)) kind = CaseRiskKind.REVOKED_NORM;
    else if (/diverg/.test(lc)) kind = CaseRiskKind.PRECEDENT_DIVERGENCE;
    else if (/hist[óo]ric|vers[ãa]o/.test(lc)) kind = CaseRiskKind.HISTORIC_VERSION;
    else if (/lacuna|ausent|sem fundament|sem ancor/.test(lc)) kind = CaseRiskKind.MISSING_GROUNDING;
    else if (/fragilid|fraco|tese.*frac/.test(lc)) kind = CaseRiskKind.WEAK_ARGUMENT;
    else if (/processual|procedimental/.test(lc)) kind = CaseRiskKind.PROCEDURAL_GAP;
    return {
      kind,
      severity: SEVERITY[r.severity] ?? CaseRiskSeverity.LOW,
      title: r.title,
      detail: r.detail,
      evidenceChunkIds: r.evidence.chunkIds,
      evidenceNormUrns: r.evidence.normUrns,
    };
  });
}
