/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

/** Origem auditável persistida em `metadataJson.origem` (e espelho `origin` quando aplicável). */
export const CASE_ENTITY_ORIGINS = [
  "entrevista_guiada",
  "documento_OCR",
  "manual",
  "deepseek_recommendation",
  "ia_extracao",
] as const;

export type CaseEntityOrigin = (typeof CASE_ENTITY_ORIGINS)[number];

/** Status de curadoria humana / extração. */
export const CASE_ENTITY_STATUSES = [
  "extraido",
  "sugerido",
  "confirmado",
  "manual",
  "duvida",
] as const;

export type CaseEntityStatus = (typeof CASE_ENTITY_STATUSES)[number];

export type CaseEntityMetadata = {
  origem?: CaseEntityOrigin | string;
  origin?: string;
  source?: string;
  status?: CaseEntityStatus | string;
  sourceText?: string;
  confidence?: number;
  /** Quando true, consolidações automáticas não alteram o registro. */
  lockedByUser?: boolean;
  /** Histórico compacto de PATCH (sem migration). */
  versionHistory?: Array<{
    at: string;
    userId?: string;
    patch: Record<string, unknown>;
  }>;
};
