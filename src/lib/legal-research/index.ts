/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

export type {
  LegalFoundationCandidate,
  LegalResearchLanguage,
  LegalResearchProvider,
  LegalResearchRequest,
  LegalResearchResponse,
  LegalResearchResultType,
  JurisprudenceCandidate,
  StrategySuggestion,
} from "./types";

export { getLegalResearchProvider } from "./provider";
export { DeepSeekLegalResearchProvider } from "./deepseek-provider";
export { promptVersion } from "./legal-research-prompts";
export { normalizeDeepSeekJsonContent } from "./normalize-deepseek-result";
export { applyLegalResearchSafety } from "./legal-research-safety";
export {
  getCachedLegalResearch,
  setCachedLegalResearch,
  legalResearchRequestHash,
} from "./legal-research-cache";
export { scrubPii, logLegalResearchJsonLine } from "./legal-research-logger";
export type { LegalResearchLogEvent } from "./legal-research-logger";
export {
  buildRetrievalSearchCompatiblePayload,
  type RetrievalSearchCompatiblePayload,
  type RetrievalSearchCompatibleResult,
} from "./retrieval-adapter";
export {
  enforceLegalResearchRateLimit,
  findCaseInWorkspace,
  isDeepseekLegalResearchDisabled,
  mergeLegalResearchRequest,
  rateLimitPerMinute,
  withHumanReviewMetadata,
} from "./route-helpers";

export {
  legalResearchMarkVerifiedBodySchema,
  legalResearchPinBodySchema,
  legalResearchRecommendBodySchema,
  legalResearchSearchBodySchema,
} from "./request-body";
