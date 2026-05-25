/**
 * Orquestrador da camada Legal Workflow Automation.
 *
 * Workflows operacionais multi-tenant. O fluxo principal de minuta/revisão
 * não usa retrieval vetorial no drafting — delega a `generateDraft` /
 * `reviewDraft` (DeepSeek via modelo de peça).
 */

import { CaseRiskKind, CaseRiskSeverity, CaseStatus, CaseTimelineKind, type CaseDraft, type CaseReview } from "@prisma/client";
import {
  appendTimelineEvent,
  createCaseFromIntake,
  getCaseById,
  persistDraft,
  persistReview,
  setCaseStatus,
} from "./repository";
import { runIntake } from "./intake";
import { runReview } from "./review";
import type { ParsedRisk } from "./types";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import { generateDraft } from "@/lib/cases/drafting/generate-draft";
import { listPinnedFoundations } from "@/lib/cases/drafting/case-brain-shim";
import { reviewDraft } from "@/lib/cases/review/review-draft";

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
  const c = await getCaseById(args.workspaceId, args.caseId);
  if (!c) {
    const err = new Error("Caso não encontrado neste workspace.");
    (err as { status?: number }).status = 404;
    throw err;
  }

  await appendTimelineEvent({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    kind: CaseTimelineKind.RESEARCH_RUN,
    message: "Geração de minuta assistida (JustOS AI) — sem retrieval vetorial",
    payloadJson: { source: "draft", mode: "deepseek" },
    userId: args.userId,
  });

  const out = await generateDraft(args.caseId, args.workspaceId, {
    confirmUnverifiedFoundations: true,
  });
  if (out.status === "blocked") {
    const err = new Error(out.reasons.join(" "));
    (err as { status?: number }).status = 409;
    throw err;
  }

  const pins = await listPinnedFoundations(args.workspaceId, args.caseId);
  const groundingChunkIds = pins.map((p) => p.chunkId);

  const draft = await persistDraft({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    content: out.content,
    groundingChunkIds,
    userId: args.userId,
    metadata: {
      workflow: "legacy-post-draft",
      foundationsUsed: out.foundationsUsed,
      inlineNotes: out.inlineNotes,
    },
  });

  if (c.status === CaseStatus.INTAKE || c.status === CaseStatus.RESEARCH) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.DRAFTING, args.userId);
  }

  return {
    draft,
    chunkIds: groundingChunkIds,
    verdict: "ok",
    lacunas: out.inlineNotes,
    unindexedFoundations: [],
    usedBrain: true,
    usedPinnedSources: pins.length,
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

  const inconsistencyRisksCount = c.risks.filter(
    (r) => r.kind === "DOCUMENT_INCONSISTENCY" && !r.resolvedAt,
  ).length;
  const pinnedChunkIds = (c.legalSources ?? [])
    .map((s) => s.chunkId)
    .filter((id): id is string => !!id);
  const draftMeta = (lastDraft.metadataJson ?? {}) as Record<string, unknown>;
  const draftUsedBrain = Boolean(draftMeta["usedBrainContext"]);

  const deterministic = runReview({
    draftContent: lastDraft.content,
    groundingChunkIds: lastDraft.groundingChunkIds,
    facts: c.facts,
    parties: c.parties,
    requests: c.requests,
    risks: [],
    issues: [],
    pinnedChunkIds,
    inconsistencyRisksCount,
    draftUsedBrain,
  });

  const llm = await reviewDraft(lastDraft.id, args.workspaceId, lastDraft.content);
  const llmAsItems: ReturnType<typeof runReview>["items"] = llm.issues.map((i) => ({
    id: i.id,
    title: i.message,
    status: i.severity === "critico" ? "fail" : i.severity === "alerta" ? "warning" : "pass",
    detail: i.hint ?? "",
    weight: 0.02,
    rationale: "Revisão assistida (JustOS AI) — confirme como advogado responsável.",
  }));

  const mergedItems = [...deterministic.items, ...llmAsItems];
  const mergedScore = Math.min(deterministic.score, llm.score);
  const mergedVerdict =
    llm.score < 0.65 ? `${deterministic.verdict} · ${llm.verdict}` : deterministic.verdict;

  const review = await persistReview({
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    score: mergedScore,
    verdict: mergedVerdict,
    checklist: mergedItems as unknown as Array<Record<string, unknown>>,
    userId: args.userId,
  });

  if (mergedVerdict === "Pronta para protocolo" && c.status === CaseStatus.DRAFTING) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.READY, args.userId);
  } else if (c.status !== CaseStatus.REVIEW) {
    await setCaseStatus(args.workspaceId, args.caseId, CaseStatus.REVIEW, args.userId);
  }

  return { review, checklist: mergedItems };
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
