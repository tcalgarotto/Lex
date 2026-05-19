/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import type { LegalResearchRequest } from "./types";

/** Versão do prompt — incluir em logs e providerMetadata. */
export const promptVersion = "legal-research-deepseek-v1.0.0";

const JSON_SHAPE = `Responda APENAS com um objeto JSON válido (sem markdown), com esta forma:
{
  "summary": string,
  "suggestedSearches": string[],
  "legalFoundations": Array<{
    "id": string,
    "type": "LAW"|"CONSTITUTION"|"CODE"|"STATUTE"|"PRINCIPLE",
    "title": string,
    "citation": string,
    "article": string | null,
    "paragraph": string | null,
    "inciso": string | null,
    "excerpt": string,
    "legalIssue": string,
    "whyRelevant": string,
    "suggestedUse": string,
    "confidence": number,
    "sourceUrl": string | null
  }>,
  "jurisprudenceCandidates": Array<{
    "id": string,
    "court": string,
    "classOrType": string,
    "processNumber": string | null,
    "rapporteur": string | null,
    "judgmentDate": string | null,
    "publicationDate": string | null,
    "title": string,
    "summary": string,
    "holding": string,
    "excerpt": string,
    "legalIssue": string,
    "whyRelevant": string,
    "suggestedUse": string,
    "confidence": number,
    "sourceUrl": string | null
  }>,
  "strategyNotes": Array<{
    "thesis": string,
    "factualRequirements": string[],
    "evidenceNeeded": string[],
    "risk": string,
    "recommendedAction": string,
    "relatedFoundations": string[],
    "relatedJurisprudence": string[]
  }>,
  "draftingSuggestions": string[],
  "riskFlags": string[],
  "missingInformation": string[]
}`;

export function buildLegalResearchSystemPrompt(): string {
  return [
    "Você é assistente jurídico de apoio à pesquisa para advogados no Brasil.",
    "Identifique a questão jurídica, sugira fundamentos aplicáveis e separe legislação de jurisprudência candidata.",
    "Nunca invente número de processo, ementa literal, link oficial ou norma inexistente.",
    "Se não tiver certeza sobre dados processuais, deixe processNumber null e explique em riskFlags ou missingInformation.",
    "Indique lacunas em missingInformation quando faltar dado do caso.",
    "Cite normas com referência verificável (lei + artigo quando aplicável).",
    "Responda em português do Brasil.",
    JSON_SHAPE,
  ].join("\n");
}

export function buildLegalResearchUserPrompt(req: LegalResearchRequest): string {
  const lines: string[] = [
    `Consulta: ${req.query}`,
    `Tipos desejados: ${req.resultTypes.join(", ")}`,
    `Idioma: ${req.language}`,
    `Máximo de itens relevantes (aprox.): ${req.maxResults}`,
  ];
  if (req.area) lines.push(`Área: ${req.area}`);
  if (req.jurisdiction) lines.push(`Jurisdição: ${req.jurisdiction}`);
  if (req.courts?.length) lines.push(`Tribunais: ${req.courts.join(", ")}`);
  if (req.dateRange?.from || req.dateRange?.to) {
    lines.push(
      `Período: ${req.dateRange.from ?? "?"} — ${req.dateRange.to ?? "?"}`,
    );
  }
  if (req.caseBrain) {
    lines.push(
      `Contexto do caso (campos selecionados da entrevista/dados organizados — não invente além disso):\n${req.caseBrain.slice(0, 12_000)}`,
    );
  }
  lines.push(
    "Inclua em riskFlags avisos explícitos se alguma sugestão depender de conferência em fonte oficial.",
  );
  return lines.join("\n");
}

export function buildRecommendForCaseUserPrompt(req: LegalResearchRequest): string {
  const base = buildLegalResearchUserPrompt(req);
  if (req.caseId) {
    return `${base}\nObjetivo: recomendar fundamentos e linha de estratégia específicos para o caso (id: ${req.caseId}).`;
  }
  return `${base}\nObjetivo: recomendar fundamentos e linha de estratégia para o caso descrito.`;
}
