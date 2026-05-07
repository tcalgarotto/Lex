/**
 * Tipos canônicos do módulo Legal Workflow Automation.
 *
 * Mantém estruturas de dados *intake-puras* — sem dependência de Prisma —
 * pra que parsers/heurísticas sejam testáveis isoladamente, e a camada de
 * persistência (repository.ts) seja responsável por traduzir.
 */

import type {
  CasePartyKind,
  CasePartyRole,
  CaseRequestKind,
  CaseRiskKind,
  CaseRiskSeverity,
  NormJurisdiction,
} from "@prisma/client";

/** Fato extraído do texto bruto. */
export type ParsedFact = {
  ordinal: number;
  text: string;
  category?: string;
  dates: string[];
  confidence: number;
};

/** Parte detectada (autor, réu, etc). */
export type ParsedParty = {
  role: CasePartyRole;
  kind: CasePartyKind;
  name: string;
  document?: string;
  metadataJson?: Record<string, unknown>;
};

/** Pedido (tutela, indenização, restituição, etc). */
export type ParsedRequest = {
  ordinal: number;
  kind: CaseRequestKind;
  text: string;
  legalBasisUrn?: string;
  metadataJson?: Record<string, unknown>;
};

/** Risco identificado (a partir de retrieval/contradiction/issue). */
export type ParsedRisk = {
  kind: CaseRiskKind;
  severity: CaseRiskSeverity;
  title: string;
  detail: string;
  evidenceChunkIds: string[];
  evidenceNormUrns: string[];
};

/** Resultado completo de um intake automático. */
export type IntakeResult = {
  title: string;
  summary: string;
  tribunalCode?: string;
  uf?: string;
  processNumber?: string;
  jurisdiction?: NormJurisdiction;
  facts: ParsedFact[];
  parties: ParsedParty[];
  requests: ParsedRequest[];
  risks: ParsedRisk[];
  /** Estratégia preliminar — preenchida pela camada que chama o retrieval. */
  strategyPreview?: string;
};
