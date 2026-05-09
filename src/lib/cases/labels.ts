/**
 * Centralized PT-BR labels for case-related enums and helpers for the
 * "Caso x Processo judicial" distinction (F1 + F1.5 do Case Brain Refactor).
 *
 * Tudo que a UI exibe deve passar por esses mappers — evita aparecer
 * "DRAFTING", "INDEXED", "REVIEW" para o usuário advogado.
 */

import type { Case } from "@prisma/client";

export const CASE_STATUS_LABEL: Record<string, string> = {
  INTAKE: "Coleta inicial",
  RESEARCH: "Em pesquisa",
  DRAFTING: "Em elaboração",
  REVIEW: "Em revisão",
  READY: "Pronta para revisão final",
  FILED: "Protocolada",
  CLOSED: "Encerrado",
  ARCHIVED: "Arquivado",
};

export const CASE_DRAFT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  GENERATED: "Gerada",
  EDITED: "Editada",
  APPROVED: "Aprovada",
};

export const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Enviado",
  PARSING: "Extraindo texto",
  PARSED: "Texto extraído",
  CHUNKING: "Segmentando",
  CHUNKED: "Segmentado",
  EMBEDDING: "Indexando",
  INDEXED: "Pronto para busca",
  FAILED: "Falhou",
};

export const CASE_REQUEST_KIND_LABEL: Record<string, string> = {
  MAIN: "Pedido principal",
  SUBSIDIARY: "Pedido subsidiário",
  URGENCY: "Pedido de urgência",
  PROVISIONAL: "Pedido cominatório",
  EVIDENCE: "Pedido probatório",
  PROCEDURAL: "Pedido processual",
  OTHER: "Outro",
};

export const CASE_PARTY_ROLE_LABEL: Record<string, string> = {
  AUTHOR: "Parte autora",
  DEFENDANT: "Parte ré",
  INTERVENING: "Terceiro interessado",
  OTHER: "Outro",
};

export const CASE_PARTY_KIND_LABEL: Record<string, string> = {
  PERSON: "Pessoa Física",
  COMPANY: "Pessoa Jurídica",
  PUBLIC_ENTITY: "Ente Público",
  UNKNOWN: "—",
};

export const CASE_RISK_SEVERITY_LABEL: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const CASE_TIMELINE_KIND_LABEL: Record<string, string> = {
  CASE_CREATED: "Caso criado",
  INTAKE_COMPLETED: "Coleta inicial concluída",
  RESEARCH_RUN: "Pesquisa executada",
  DRAFT_GENERATED: "Peça gerada",
  DRAFT_EDITED: "Peça editada",
  REVIEW_RUN: "Revisão executada",
  RISK_FLAGGED: "Risco sinalizado",
  STATUS_CHANGED: "Status alterado",
  NOTE: "Anotação",
  STRATEGY_GENERATED: "Estratégia gerada",
  BRAIN_GENERATED: "Inteligência do caso atualizada",
  DOCUMENT_INCONSISTENCY: "Inconsistência de documento",
};

/**
 * Etiqueta amigável para `CaseStatus`. Sempre devolve algo legível
 * (cai no enum cru se valor desconhecido).
 */
export function caseStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return CASE_STATUS_LABEL[status] ?? status;
}

export function caseDraftStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return CASE_DRAFT_STATUS_LABEL[status] ?? status;
}

export function documentStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return DOCUMENT_STATUS_LABEL[status] ?? status;
}

export function caseRequestKindLabel(kind: string | null | undefined): string {
  if (!kind) return "—";
  return CASE_REQUEST_KIND_LABEL[kind] ?? kind;
}

export function casePartyRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return CASE_PARTY_ROLE_LABEL[role] ?? role;
}

export function casePartyKindLabel(kind: string | null | undefined): string {
  if (!kind) return "—";
  return CASE_PARTY_KIND_LABEL[kind] ?? kind;
}

export function caseRiskSeverityLabel(severity: string | null | undefined): string {
  if (!severity) return "—";
  return CASE_RISK_SEVERITY_LABEL[severity] ?? severity;
}

export function caseTimelineKindLabel(kind: string | null | undefined): string {
  if (!kind) return "—";
  return CASE_TIMELINE_KIND_LABEL[kind] ?? kind;
}

/**
 * Mensagem amigável para evento de pesquisa/retrieval na timeline.
 * Substitui "retrieval: N chunks" por "N fundamentos normativos consultados".
 */
export function retrievalCountMessage(n: number): string {
  if (n === 0) return "Nenhum fundamento normativo consultado";
  if (n === 1) return "1 fundamento normativo consultado";
  return `${n} fundamentos normativos consultados`;
}

/* ----------------------- Caso x Processo (F1.5) ------------------------ */

/**
 * Tipo mínimo necessário para identificar caso pré-processual.
 * Usar `Case` direto também funciona graças à compatibilidade estrutural.
 */
export type CaseLike = Pick<Case, "processNumber" | "processId">;

/**
 * Verdadeiro quando o caso ainda não tem processo judicial vinculado:
 *  - sem `processNumber` (CNJ não foi informado);
 *  - sem `processId` (não foi vinculado a Process da tabela legada).
 *
 * Caso pré-processual é a entidade primária — Process é opcional.
 */
export function isCasePreProcessual(c: CaseLike): boolean {
  const noNumber = c.processNumber === null || c.processNumber === undefined || c.processNumber.trim() === "";
  const noProcess = c.processId === null || c.processId === undefined;
  return noNumber && noProcess;
}

/**
 * Mensagem-padrão para badge "Pré-processual" no painel do caso.
 */
export const PRE_PROCESSUAL_MESSAGE =
  "Pré-processual — ainda sem número CNJ. O processo judicial será vinculado após o protocolo.";
