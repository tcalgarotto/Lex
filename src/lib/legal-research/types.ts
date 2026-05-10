/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

export type LegalResearchResultType =
  | "LAW"
  | "JURISPRUDENCE"
  | "THESIS"
  | "STRATEGY"
  | "DRAFTING_SUPPORT";

export type LegalResearchLanguage = "pt-BR";

export type LegalFoundationType =
  | "LAW"
  | "CONSTITUTION"
  | "CODE"
  | "STATUTE"
  | "PRINCIPLE";

export type FoundationVerificationStatus =
  | "AI_RECOMMENDED_UNVERIFIED"
  | "USER_PINNED"
  | "VERIFIED_BY_INTERNAL_RAG"
  | "VERIFIED_BY_OFFICIAL_SOURCE";

export type JurisprudenceVerificationStatus =
  | "AI_RECOMMENDED_UNVERIFIED"
  | "USER_PINNED"
  | "VERIFIED_BY_OFFICIAL_SOURCE";

export interface LegalResearchRequest {
  workspaceId: string;
  caseId?: string;
  query: string;
  caseBrain?: string;
  area?: string;
  jurisdiction?: string;
  courts?: string[];
  dateRange?: { from?: string; to?: string };
  resultTypes: LegalResearchResultType[];
  maxResults: number;
  language: LegalResearchLanguage;
}

export interface LegalFoundationCandidate {
  id: string;
  type: LegalFoundationType;
  title: string;
  citation: string;
  article?: string;
  paragraph?: string;
  inciso?: string;
  excerpt: string;
  legalIssue: string;
  whyRelevant: string;
  suggestedUse: string;
  confidence: number;
  verificationStatus: FoundationVerificationStatus;
  sourceUrl?: string;
  warnings: string[];
}

export interface JurisprudenceCandidate {
  id: string;
  court: string;
  classOrType: string;
  processNumber?: string;
  rapporteur?: string;
  judgmentDate?: string;
  publicationDate?: string;
  title: string;
  summary: string;
  holding: string;
  excerpt: string;
  legalIssue: string;
  whyRelevant: string;
  suggestedUse: string;
  confidence: number;
  verificationStatus: JurisprudenceVerificationStatus;
  sourceUrl?: string;
  warnings: string[];
}

export interface StrategySuggestion {
  thesis: string;
  factualRequirements: string[];
  evidenceNeeded: string[];
  risk: string;
  recommendedAction: string;
  relatedFoundations: string[];
  relatedJurisprudence: string[];
}

export interface LegalResearchResponse {
  summary: string;
  suggestedSearches: string[];
  legalFoundations: LegalFoundationCandidate[];
  jurisprudenceCandidates: JurisprudenceCandidate[];
  strategyNotes: StrategySuggestion[];
  draftingSuggestions: string[];
  riskFlags: string[];
  missingInformation: string[];
  providerMetadata: Record<string, unknown>;
}

export interface LegalResearchProvider {
  search(req: LegalResearchRequest): Promise<LegalResearchResponse>;
  recommendForCase(req: LegalResearchRequest): Promise<LegalResearchResponse>;
}
