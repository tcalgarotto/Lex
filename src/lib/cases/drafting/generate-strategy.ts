/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { generateText } from "ai";
import { getLanguageModelForLexTask, getProviderOptionsForLexTask } from "@/lib/ai/llm";
import { getCaseBrainSnapshot, listPinnedFoundations } from "@/lib/cases/drafting/case-brain-shim";
import type { StrategyResult } from "@/lib/cases/drafting/drafting-types";

function safeJsonParse(text: string): StrategyResult | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const v = JSON.parse(trimmed) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const pickStrArr = (k: string): string[] =>
      Array.isArray(o[k]) ? o[k]!.filter((x): x is string => typeof x === "string") : [];
    const mainThesis = typeof o["mainThesis"] === "string" ? o["mainThesis"] : undefined;
    const theses = pickStrArr("theses");
    const mergedTheses =
      theses.length > 0
        ? theses
        : mainThesis
          ? [mainThesis]
          : pickStrArr("alternativeTheses");
    const risksRaw = pickStrArr("risks");
    const procRisks = pickStrArr("proceduralRisks");
    return {
      theses: mergedTheses.length ? mergedTheses : mainThesis ? [mainThesis] : [],
      mainThesis,
      alternativeTheses: pickStrArr("alternativeTheses"),
      factualRequirements: pickStrArr("factualRequirements"),
      evidenceNeeded: pickStrArr("evidenceNeeded"),
      risks: risksRaw.length > 0 ? risksRaw : procRisks,
      recommendedActions: pickStrArr("recommendedActions"),
      relatedFoundations: pickStrArr("relatedFoundations"),
      suggestedLegalFoundations: pickStrArr("suggestedLegalFoundations"),
      candidateJurisprudence: pickStrArr("candidateJurisprudence"),
      recommendedClaims: pickStrArr("recommendedClaims"),
      proceduralRisks: procRisks,
      gaps: pickStrArr("gaps"),
      suggestedPieceStructure: pickStrArr("suggestedPieceStructure"),
      humanReviewWarnings: pickStrArr("humanReviewWarnings"),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function generateStrategy(
  caseId: string,
  workspaceId: string,
): Promise<StrategyResult> {
  const snap = await getCaseBrainSnapshot(workspaceId, caseId);
  if (!snap) {
    throw Object.assign(new Error("Caso não encontrado neste workspace."), { status: 404 });
  }

  const pins = await listPinnedFoundations(workspaceId, caseId);
  const pinBlock = pins
    .map(
      (p, i) =>
        `[${i + 1}] ${p.citation}\nTrecho: ${p.excerpt.slice(0, 600)}${p.excerpt.length > 600 ? "…" : ""}`,
    )
    .join("\n\n");

  const parties = snap.brain
    ? snap.brain.parties.map((p) => `- (${p.role}) ${p.name}`).join("\n")
    : snap.parties.map((p) => `- (${p.role}) ${p.name}`).join("\n");

  const facts = snap.brain
    ? snap.brain.facts.map((f) => `- ${f.text}`).join("\n")
    : snap.facts.map((f) => `- ${f.text}`).join("\n");

  const requests = snap.brain
    ? snap.brain.requests.map((r) => `- (${r.kind}) ${r.text}`).join("\n")
    : snap.requests.map((r) => `- (${r.kind}) ${r.text}`).join("\n");

  const risks = snap.brain
    ? snap.brain.risks.map((r) => `- [${r.severity}] ${r.title}: ${r.detail}`).join("\n")
    : snap.risks.map((r) => `- ${r.title}: ${r.detail}`).join("\n");

  const prompt = `Você é assistente jurídico interno do Lex. Produza APENAS JSON válido (sem markdown ao redor) com o formato:
{
  "mainThesis": string,
  "theses": string[],
  "alternativeTheses": string[],
  "factualRequirements": string[],
  "evidenceNeeded": string[],
  "risks": string[],
  "proceduralRisks": string[],
  "recommendedActions": string[],
  "suggestedLegalFoundations": string[],
  "candidateJurisprudence": string[],
  "recommendedClaims": string[],
  "gaps": string[],
  "suggestedPieceStructure": string[],
  "humanReviewWarnings": string[],
  "relatedFoundations": string[]
}

Regras:
- Use somente os dados fornecidos abaixo e os fundamentos pinados. Não invente normas verificadas fora dos trechos pinados.
- Em candidateJurisprudence, liste apenas rótulos curtos como CANDIDATO — nunca afirme que foi verificado em tribunal.
- "humanReviewWarnings" deve alertar revisão humana obrigatória antes de protocolar.
- Texto em pt-BR, tom profissional, sem jargão interno de software.

Partes:
${parties || "(nenhuma)"}

Fatos:
${facts || "(nenhum)"}

Pedidos:
${requests || "(nenhum)"}

Riscos consolidados:
${risks || "(nenhum)"}

Fundamentos pinados:
${pinBlock || "(nenhum — descreva lacunas em gaps)"}
`;

  const { text } = await generateText({
    model: getLanguageModelForLexTask("strategy"),
    providerOptions: getProviderOptionsForLexTask("strategy"),
    temperature: 0.25,
    maxOutputTokens: 2500,
    prompt,
  });

  const parsed = safeJsonParse(text);
  if (parsed) return parsed;

  return {
    theses: [text.slice(0, 800)],
    mainThesis: text.slice(0, 400),
    factualRequirements: [],
    evidenceNeeded: [],
    risks: [],
    recommendedActions: [],
    relatedFoundations: [],
    humanReviewWarnings: ["Falha ao interpretar JSON do modelo — revise o texto bruto e tente gerar novamente."],
    generatedAt: new Date().toISOString(),
  };
}
