/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { z } from "zod";
import type { LegalResearchResponse } from "./types";
import { promptVersion } from "./legal-research-prompts";

const foundationTypeZ = z.enum([
  "LAW",
  "CONSTITUTION",
  "CODE",
  "STATUTE",
  "PRINCIPLE",
]);

const rawFoundationZ = z.object({
  id: z.string().optional(),
  type: foundationTypeZ.optional(),
  title: z.string().optional(),
  citation: z.string().optional(),
  article: z.string().nullable().optional(),
  paragraph: z.string().nullable().optional(),
  inciso: z.string().nullable().optional(),
  excerpt: z.string().optional(),
  legalIssue: z.string().optional(),
  whyRelevant: z.string().optional(),
  suggestedUse: z.string().optional(),
  confidence: z.number().optional(),
  sourceUrl: z.string().nullable().optional(),
});

const rawJurisZ = z.object({
  id: z.string().optional(),
  court: z.string().optional(),
  classOrType: z.string().optional(),
  processNumber: z.string().nullable().optional(),
  rapporteur: z.string().nullable().optional(),
  judgmentDate: z.string().nullable().optional(),
  publicationDate: z.string().nullable().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  holding: z.string().optional(),
  excerpt: z.string().optional(),
  legalIssue: z.string().optional(),
  whyRelevant: z.string().optional(),
  suggestedUse: z.string().optional(),
  confidence: z.number().optional(),
  sourceUrl: z.string().nullable().optional(),
});

const strategyZ = z.object({
  thesis: z.string().optional(),
  factualRequirements: z.array(z.string()).optional(),
  evidenceNeeded: z.array(z.string()).optional(),
  risk: z.string().optional(),
  recommendedAction: z.string().optional(),
  relatedFoundations: z.array(z.string()).optional(),
  relatedJurisprudence: z.array(z.string()).optional(),
});

const rawPayloadZ = z.object({
  summary: z.string().optional(),
  suggestedSearches: z.array(z.string()).optional(),
  legalFoundations: z.array(rawFoundationZ).optional(),
  jurisprudenceCandidates: z.array(rawJurisZ).optional(),
  strategyNotes: z.array(strategyZ).optional(),
  draftingSuggestions: z.array(z.string()).optional(),
  riskFlags: z.array(z.string()).optional(),
  missingInformation: z.array(z.string()).optional(),
});

function newId(prefix: string, i: number): string {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp01(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function normalizeDeepSeekJsonContent(
  rawText: string,
  providerExtras: Record<string, unknown>,
): LegalResearchResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return errorResponse(
      "Resposta do provedor não era JSON válido; tente novamente ou simplifique a consulta.",
      providerExtras,
    );
  }

  const decoded = rawPayloadZ.safeParse(parsed);
  if (!decoded.success) {
    return errorResponse(
      "Estrutura da resposta do provedor inesperada; tente novamente.",
      providerExtras,
    );
  }

  const d = decoded.data;
  const legalFoundations = (d.legalFoundations ?? []).map((f, i) => ({
    id: f.id?.trim() || newId("lf", i),
    type: f.type ?? ("LAW" as const),
    title: f.title?.trim() || "Fundamento (sem título)",
    citation: f.citation?.trim() || "",
    article: f.article ?? undefined,
    paragraph: f.paragraph ?? undefined,
    inciso: f.inciso ?? undefined,
    excerpt: f.excerpt?.trim() || "",
    legalIssue: f.legalIssue?.trim() || "",
    whyRelevant: f.whyRelevant?.trim() || "",
    suggestedUse: f.suggestedUse?.trim() || "",
    confidence: clamp01(f.confidence),
    verificationStatus: "AI_RECOMMENDED_UNVERIFIED" as const,
    sourceUrl: f.sourceUrl ?? undefined,
    warnings: ["Sugestão de IA — a conferir.", "Não invente fatos nem cite como se fosse verificado em fonte oficial sem conferência humana."] as string[],
  }));

  const jurisprudenceCandidates = (d.jurisprudenceCandidates ?? []).map((j, i) => ({
    id: j.id?.trim() || newId("ju", i),
    court: j.court?.trim() || "Tribunal não informado",
    classOrType: j.classOrType?.trim() || "Classe não informada",
    processNumber: j.processNumber ?? undefined,
    rapporteur: j.rapporteur ?? undefined,
    judgmentDate: j.judgmentDate ?? undefined,
    publicationDate: j.publicationDate ?? undefined,
    title: j.title?.trim() || "Decisão (sem título)",
    summary: j.summary?.trim() || "",
    holding: j.holding?.trim() || "",
    excerpt: j.excerpt?.trim() || "",
    legalIssue: j.legalIssue?.trim() || "",
    whyRelevant: j.whyRelevant?.trim() || "",
    suggestedUse: j.suggestedUse?.trim() || "",
    confidence: clamp01(j.confidence),
    verificationStatus: "AI_RECOMMENDED_UNVERIFIED" as const,
    sourceUrl: j.sourceUrl ?? undefined,
    warnings: [
      "Jurisprudência candidata — confirme a fonte oficial antes de citar em peça.",
    ] as string[],
  }));

  const strategyNotes = (d.strategyNotes ?? []).map((s) => ({
    thesis: s.thesis?.trim() || "",
    factualRequirements: s.factualRequirements ?? [],
    evidenceNeeded: s.evidenceNeeded ?? [],
    risk: s.risk?.trim() || "",
    recommendedAction: s.recommendedAction?.trim() || "",
    relatedFoundations: s.relatedFoundations ?? [],
    relatedJurisprudence: s.relatedJurisprudence ?? [],
  }));

  return {
    summary: d.summary?.trim() || "",
    suggestedSearches: d.suggestedSearches ?? [],
    legalFoundations,
    jurisprudenceCandidates,
    strategyNotes,
    draftingSuggestions: d.draftingSuggestions ?? [],
    riskFlags: d.riskFlags ?? [],
    missingInformation: d.missingInformation ?? [],
    providerMetadata: {
      ...providerExtras,
      promptVersion,
      normalized: true,
    },
  };
}

function errorResponse(
  message: string,
  providerExtras: Record<string, unknown>,
): LegalResearchResponse {
  return {
    summary: message,
    suggestedSearches: [],
    legalFoundations: [],
    jurisprudenceCandidates: [],
    strategyNotes: [],
    draftingSuggestions: [],
    riskFlags: ["Falha ao interpretar a resposta estruturada do provedor."],
    missingInformation: ["Reexecute a pesquisa ou reduza o escopo da pergunta."],
    providerMetadata: {
      ...providerExtras,
      promptVersion,
      normalized: false,
      parseError: true,
    },
  };
}
