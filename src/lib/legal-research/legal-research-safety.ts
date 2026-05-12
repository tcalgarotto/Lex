/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import type {
  JurisprudenceCandidate,
  LegalFoundationCandidate,
  LegalResearchResponse,
} from "./types";

const MISSING_CITATION =
  "Fundamento sem citação normativa clara — confira em fonte oficial antes de usar.";
const MISSING_SOURCE =
  "Sem URL de fonte oficial — confira lei, súmula ou jurisprudência em repositório confiável.";
const JURIS_NO_PROCESS =
  "Jurisprudência candidata sem número de processo — confirme a fonte antes de citar.";
const STRIP_AUTO_VERIFY =
  "Verificação em fonte oficial ou índice interno não aplicável neste fluxo — exige confirmação humana no produto.";

/**
 * Regras de segurança e rotulagem: nunca promove automaticamente para
 * fundamento aprovado ou verificado por fonte oficial.
 */
export function applyLegalResearchSafety(
  res: LegalResearchResponse,
): LegalResearchResponse {
  const legalFoundations: LegalFoundationCandidate[] = res.legalFoundations.map(
    (f) => {
      const warnings = [...f.warnings];
      let verificationStatus = f.verificationStatus;

      if (!f.citation?.trim()) {
        warnings.push(MISSING_CITATION);
      }
      if (!f.sourceUrl?.trim()) {
        warnings.push(MISSING_SOURCE);
      }

      if (
        verificationStatus === "VERIFIED_BY_INTERNAL_RAG" ||
        verificationStatus === "VERIFIED_BY_OFFICIAL_SOURCE"
      ) {
        verificationStatus = "AI_RECOMMENDED_UNVERIFIED";
        warnings.push(STRIP_AUTO_VERIFY);
      } else if (verificationStatus !== "USER_PINNED") {
        verificationStatus = "AI_RECOMMENDED_UNVERIFIED";
      }

      return { ...f, warnings, verificationStatus };
    },
  );

  const jurisprudenceCandidates: JurisprudenceCandidate[] =
    res.jurisprudenceCandidates.map((j) => {
      const warnings = [...j.warnings];
      let verificationStatus = j.verificationStatus;

      if (!j.processNumber?.trim()) {
        warnings.push(JURIS_NO_PROCESS);
        verificationStatus = "AI_RECOMMENDED_UNVERIFIED";
      }

      if (verificationStatus === "VERIFIED_BY_OFFICIAL_SOURCE") {
        verificationStatus = "AI_RECOMMENDED_UNVERIFIED";
        warnings.push(STRIP_AUTO_VERIFY);
      } else if (verificationStatus !== "USER_PINNED") {
        verificationStatus = "AI_RECOMMENDED_UNVERIFIED";
      }

      return { ...j, warnings, verificationStatus };
    });

  return {
    ...res,
    legalFoundations,
    jurisprudenceCandidates,
  };
}
