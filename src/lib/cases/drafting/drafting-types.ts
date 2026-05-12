/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import type { FoundationVerificationStatus } from "@/lib/legal-research/types";

export type StrategyResult = {
  theses: string[];
  /** Tese principal (P0 — DeepSeek). */
  mainThesis?: string;
  alternativeTheses?: string[];
  factualRequirements: string[];
  evidenceNeeded: string[];
  risks: string[];
  recommendedActions: string[];
  relatedFoundations: string[];
  suggestedLegalFoundations?: string[];
  candidateJurisprudence?: string[];
  recommendedClaims?: string[];
  proceduralRisks?: string[];
  gaps?: string[];
  suggestedPieceStructure?: string[];
  humanReviewWarnings?: string[];
  generatedAt: string;
};

export type DraftFoundationUse = {
  ref: string;
  origin: "pinned" | "verified";
  label: string;
};

export type DraftResultOk = {
  status: "ok";
  content: string;
  foundationsUsed: DraftFoundationUse[];
  inlineNotes: string[];
};

export type DraftResultBlocked = {
  status: "blocked";
  reasons: string[];
};

export type DraftResult = DraftResultOk | DraftResultBlocked;

export type GenerateDraftOptions = {
  /**
   * Quando verdadeiro, permite citar fundamentos com indicação automática ainda sem revisão humana.
   * Sem isso, o guard bloqueia se houver itens `AI_RECOMMENDED_UNVERIFIED` entre os pinados estendidos.
   */
  confirmUnverifiedFoundations?: boolean;
};

export type PinnedFoundationListItem = {
  id: string;
  chunkId: string;
  normUrn: string | null;
  articleRef: string | null;
  excerpt: string;
  verificationStatus: FoundationVerificationStatus;
  title: string;
  citation: string;
};

export type PinnedJurisprudenceListItem = {
  id: string;
  court: string;
  title: string;
  processNumber?: string;
  verificationStatus: string;
  excerpt?: string;
};

export type ReviewIssueSeverity = "critico" | "alerta" | "sugestao";

export type ReviewIssue = {
  id: string;
  severity: ReviewIssueSeverity;
  message: string;
  hint?: string;
};

export type ReviewResult = {
  score: number;
  verdict: string;
  issues: ReviewIssue[];
};
