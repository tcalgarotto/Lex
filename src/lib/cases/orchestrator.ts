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
}): Promise<{ draft: CaseDraft; chunkIds: string[]; verdict: string }> {
  const c = await getCaseById(args.workspaceId, args.caseId);
  if (!c) {
    const err = new Error("Caso não encontrado neste workspace.");
    (err as { status?: number }).status = 404;
    throw err;
  }

  // Query montada deterministicamente a partir do caso
  const querySources = [
    c.summary ?? c.title,
    ...c.facts.slice(0, 4).map((f) => f.text),
    ...c.requests.slice(0, 3).map((r) => r.text),
  ].filter((s): s is string => !!s && s.length > 0);
  const query = querySources.join(" ").slice(0, 1500);

  await appendTimelineEvent({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    kind: "RESEARCH_RUN",
    message: "Pesquisa jurisprudencial automática iniciada",
    payloadJson: { source: "draft" },
    userId: args.userId,
  });

  const filters: Parameters<typeof retrieveLegalContext>[1] = {
    topK: 12,
    workspaceId: args.workspaceId,
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

  // Persiste riscos como CaseRisk antes do draft
  const parsedRisks = mapContradictionToCaseRisks(risks);
  if (parsedRisks.length) {
    await persistRisks({ workspaceId: args.workspaceId, caseId: args.caseId, risks: parsedRisks });
  }

  const draftBundle = buildDraft({
    case: c,
    facts: c.facts,
    parties: c.parties,
    requests: c.requests,
    chunks: retrieval.chunks,
    strategy,
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
      query,
      issuesCount: issues.length,
      risksCount: risks.length,
    },
  });

  if (c.status === CaseStatus.INTAKE || c.status === CaseStatus.RESEARCH) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.DRAFTING, args.userId);
  }

  return {
    draft,
    chunkIds: draftBundle.groundingChunkIds,
    verdict: retrieval.confidence.label,
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

  const result = runReview({
    draftContent: lastDraft.content,
    groundingChunkIds: lastDraft.groundingChunkIds,
    facts: c.facts,
    requests: c.requests,
    risks,
    issues,
  });

  const review = await persistReview({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    score: result.score,
    verdict: result.verdict,
    checklist: result.items as unknown as Array<Record<string, unknown>>,
    userId: args.userId,
  });

  if (result.score >= 0.85 && c.status === CaseStatus.DRAFTING) {
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
