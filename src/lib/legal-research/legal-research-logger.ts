/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RG = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
/** Telefones BR comuns (8–13 dígitos com separadores) */
const PHONE =
  /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-.\s]?\d{4}\b|\b\d{10,13}\b/g;

export function scrubPii(text: string): string {
  return text
    .replace(CPF, "[CPF]")
    .replace(RG, "[RG]")
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[telefone]");
}

export type LegalResearchLogEvent =
  | "legal_research.search"
  | "legal_research.recommend"
  | "legal_research.pin"
  | "legal_research.mark_verified";

export function logLegalResearchJsonLine(payload: {
  event: LegalResearchLogEvent;
  workspaceId: string;
  caseId?: string;
  queryLen: number;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  promptVersion: string;
  ok: boolean;
  errorCode?: string;
  extra?: Record<string, unknown>;
}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    channel: "lex.legal_research",
    ...payload,
    workspaceId: scrubPii(payload.workspaceId),
    caseId: payload.caseId ? scrubPii(payload.caseId) : undefined,
  });
  console.log(line);
}
