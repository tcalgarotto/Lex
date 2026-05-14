/**
 * Case Legal Workflow — fases jurídicas, DoD heurístico e políticas de bloqueio.
 * Sem persistência nova: deriva de dados já carregados no caso + checklist bootstrap.
 */

import type { DocumentStatus } from "@prisma/client";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import { hasStrategy } from "@/lib/cases/case-progress-model";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";

export type WorkflowPhaseId =
  | "coleta"
  | "documentos"
  | "fatos"
  | "pesquisa"
  | "estrategia"
  | "peca"
  | "revisao"
  | "protocolo";

export type WorkflowStepVisual = "done" | "current" | "blocked" | "pending";

export type WorkflowPhaseUi = {
  id: WorkflowPhaseId;
  label: string;
  shortLabel: string;
  state: WorkflowStepVisual;
  /** Critérios de Definition of Done ainda pendentes (tooltip). */
  pendingCriteria: string[];
};

export type CaseLegalWorkflowInput = {
  metadataJson: unknown;
  rawInput: string | null;
  checklistMissingCount: number;
  checklistAnsweredAt: string | null;
  documents: Array<{ status: DocumentStatus; updatedAt: Date }>;
  facts: { id: string }[];
  parties: { id: string }[];
  requests: { id: string }[];
  legalSources: { id: string }[];
  drafts: { id: string }[];
  reviews: { id: string }[];
  readiness: ProceduralReadiness | null;
  /** Prontidão bloqueia geração de minuta. */
  draftBlocked: boolean;
  /** Última atividade conhecida (ex.: `Case.updatedAt`). */
  caseUpdatedAt: Date;
  caseCreatedAt: Date;
  openRiskCount: number;
};

export type CaseLegalWorkflowView = {
  phases: WorkflowPhaseUi[];
  currentPhaseId: WorkflowPhaseId | null;
  currentPhaseLabel: string;
  flowComplete: boolean;
  /** Mensagens de política / bloqueio (primeiras = mais urgentes). */
  blockerMessages: string[];
  /** DoD pendente na fase atual (máx. exibido no copiloto). */
  currentPhasePendingCriteria: string[];
  flowMetrics: {
    createdLabel: string;
    updatedLabel: string;
    readinessScore: number | null;
    stalledDocuments: number;
    openRisks: number;
  };
};

const PHASE_DEFS: { id: WorkflowPhaseId; label: string; shortLabel: string }[] = [
  { id: "coleta", label: "Coleta inicial", shortLabel: "Coleta" },
  { id: "documentos", label: "Documentos", shortLabel: "Docs" },
  { id: "fatos", label: "Fatos e partes", shortLabel: "Fatos" },
  { id: "pesquisa", label: "Pesquisa jurídica", shortLabel: "Pesquisa" },
  { id: "estrategia", label: "Estratégia", shortLabel: "Estratégia" },
  { id: "peca", label: "Peça", shortLabel: "Peça" },
  { id: "revisao", label: "Revisão", shortLabel: "Revisão" },
  { id: "protocolo", label: "Pronto para protocolo", shortLabel: "Protocolo" },
];

function readProtocolManualConfirmed(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object") return false;
  const brain = (metadataJson as { brain?: unknown }).brain;
  if (!brain || typeof brain !== "object") return false;
  const workflow = (brain as { workflow?: unknown }).workflow;
  if (!workflow || typeof workflow !== "object") return false;
  return Boolean((workflow as { protocolReadyConfirmed?: unknown }).protocolReadyConfirmed);
}

function phaseSatisfied(id: WorkflowPhaseId, ctx: CaseLegalWorkflowInput): { ok: boolean; pending: string[] } {
  const pending: string[] = [];
  const raw = (ctx.rawInput ?? "").trim();
  const hasRelatoMin = raw.length >= 20;
  const checklistOk = ctx.checklistMissingCount === 0;
  const answered = Boolean(ctx.checklistAnsweredAt);

  switch (id) {
    case "coleta": {
      if (!checklistOk) pending.push(`Concluir entrevista (${ctx.checklistMissingCount} pendência(s))`);
      if (!hasRelatoMin && !answered) pending.push("Relato mínimo ou entrevista concluída");
      return { ok: checklistOk && (hasRelatoMin || answered), pending };
    }
    case "documentos": {
      if (ctx.documents.length === 0) pending.push("Anexar pelo menos 1 documento");
      const allFailed =
        ctx.documents.length > 0 && ctx.documents.every((d) => d.status === "FAILED");
      if (allFailed) pending.push("Documentos com falha crítica — reenviar ou corrigir");
      const stalled = ctx.documents.filter((d) => deriveDocumentDisplayStatus(d).stalled).length;
      if (stalled > 0) pending.push(`${stalled} documento(s) travado(s) na fila`);
      const hasIndexed = ctx.documents.some((d) => d.status === "INDEXED");
      if (ctx.documents.length > 0 && !hasIndexed && !allFailed) {
        pending.push("Concluir indexação dos documentos");
      }
      const ok =
        ctx.documents.length > 0 &&
        !allFailed &&
        stalled === 0 &&
        hasIndexed;
      return { ok, pending };
    }
    case "fatos": {
      if (ctx.facts.length === 0) pending.push("Registrar fatos (extração ou manual)");
      if (ctx.parties.length === 0) pending.push("Identificar partes principais");
      if (ctx.requests.length === 0) pending.push("Indicar pedidos preliminares");
      return { ok: ctx.facts.length > 0 && ctx.parties.length > 0 && ctx.requests.length > 0, pending };
    }
    case "pesquisa": {
      if (ctx.legalSources.length === 0) pending.push("Salvar ou pinar ao menos 1 fundamento");
      return { ok: ctx.legalSources.length > 0, pending };
    }
    case "estrategia": {
      if (!hasStrategy(ctx.metadataJson)) pending.push("Gerar ou registrar estratégia inicial");
      return { ok: hasStrategy(ctx.metadataJson), pending };
    }
    case "peca": {
      if (ctx.drafts.length === 0) pending.push("Gerar minuta");
      if (ctx.drafts.length === 0 && ctx.draftBlocked) pending.push("Prontidão insuficiente para minuta segura");
      return { ok: ctx.drafts.length > 0, pending };
    }
    case "revisao": {
      if (ctx.reviews.length === 0) pending.push("Executar revisão (humana ou assistida)");
      return { ok: ctx.reviews.length > 0, pending };
    }
    case "protocolo": {
      if (!readProtocolManualConfirmed(ctx.metadataJson)) {
        pending.push("Confirmação manual do advogado (nunca automática)");
      }
      return { ok: readProtocolManualConfirmed(ctx.metadataJson), pending };
    }
    default:
      return { ok: false, pending: [] };
  }
}

function firstOpenPhase(ctx: CaseLegalWorkflowInput): WorkflowPhaseId | null {
  for (const { id } of PHASE_DEFS) {
    const { ok } = phaseSatisfied(id, ctx);
    if (!ok) return id;
  }
  return null;
}

function buildBlockers(ctx: CaseLegalWorkflowInput, current: WorkflowPhaseId | null): string[] {
  const out: string[] = [];
  if (ctx.checklistMissingCount > 0) {
    out.push("Peça e revisão bloqueadas: entrevista incompleta.");
  }
  if (ctx.documents.length === 0 && current && current !== "coleta") {
    out.push("Fases seguintes bloqueadas: nenhum documento anexado.");
  }
  if (ctx.drafts.length === 0 && ctx.draftBlocked && hasStrategy(ctx.metadataJson)) {
    out.push("Peça bloqueada: prontidão processual insuficiente.");
  }
  if (ctx.drafts.length === 0 && current === "revisao") {
    out.push("Revisão bloqueada: nenhuma minuta gerada.");
  }
  if (!readProtocolManualConfirmed(ctx.metadataJson) && current === "protocolo") {
    out.push("Protocolo bloqueado: confirmação manual pendente.");
  }
  const stalled = ctx.documents.filter((d) => deriveDocumentDisplayStatus(d).stalled).length;
  if (stalled > 0) {
    out.push(`${stalled} documento(s) travado(s) — reprocessar na aba Documentos.`);
  }
  return [...new Set(out)];
}

export function computeCaseLegalWorkflow(ctx: CaseLegalWorkflowInput): CaseLegalWorkflowView {
  const firstOpen = firstOpenPhase(ctx);
  const flowComplete = firstOpen === null;
  const currentPending = flowComplete || !firstOpen ? [] : phaseSatisfied(firstOpen, ctx).pending;

  const stalledDocuments = ctx.documents.filter((d) => deriveDocumentDisplayStatus(d).stalled).length;

  const currentIndex = flowComplete ? PHASE_DEFS.length : PHASE_DEFS.findIndex((p) => p.id === firstOpen);

  const phases: WorkflowPhaseUi[] = PHASE_DEFS.map((def, index) => {
    const { ok, pending } = phaseSatisfied(def.id, ctx);

    let state: WorkflowStepVisual;
    if (ok || flowComplete) {
      state = "done";
    } else if (index === currentIndex) {
      const hard =
        (def.id === "documentos" && stalledDocuments > 0) ||
        (def.id === "peca" && ctx.drafts.length === 0 && ctx.draftBlocked && hasStrategy(ctx.metadataJson));
      state = hard ? "blocked" : "current";
    } else {
      state = "pending";
    }

    return {
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      state,
      pendingCriteria: pending,
    };
  });

  const blockerMessages = buildBlockers(ctx, firstOpen);

  return {
    phases,
    currentPhaseId: firstOpen,
    currentPhaseLabel: flowComplete ? "Fluxo completo" : PHASE_DEFS.find((p) => p.id === firstOpen)!.label,
    flowComplete,
    blockerMessages,
    currentPhasePendingCriteria: flowComplete ? [] : currentPending,
    flowMetrics: {
      createdLabel: ctx.caseCreatedAt.toLocaleDateString("pt-BR"),
      updatedLabel: ctx.caseUpdatedAt.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      readinessScore: ctx.readiness?.score ?? null,
      stalledDocuments,
      openRisks: ctx.openRiskCount,
    },
  };
}
