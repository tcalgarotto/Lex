/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { getCorpusManifest } from "@/lib/corpus/manifest";
import { getLegalResearchProvider } from "./provider";
import type { LegalResearchRequest } from "./types";

/** Forma compatível com o JSON de `GET /api/retrieval/search` (camada legislacao). */
export interface RetrievalSearchCompatibleResult {
  layer: "legislacao";
  id: string;
  text: string;
  snippet: string;
  articleRef: string | null;
  hierarchy: string | null;
  score: number;
  source: string;
  article: string | null;
  excerpt: string;
  reason: string;
  origin: string;
  referenceDate: string;
  norm: {
    id: string;
    urn: string;
    kind: string;
    identifier: string | null;
    title: string;
    jurisdiction: string;
    tribunal: string | null;
  };
}

export interface RetrievalSearchCompatiblePayload {
  query: string;
  scope: string;
  caseId: string | null;
  layers: string[];
  results: RetrievalSearchCompatibleResult[];
  libraryMatches: unknown[];
  casePins: unknown[];
  pieceMatches: unknown[];
  pendingLayers: string[];
  total: number;
  bases: Array<{
    key: string;
    label: string;
    available: boolean;
    hint?: string;
  }>;
  confidence: { label: string; score: number; reason: string } | null;
  cached: boolean;
  /** Indica que o payload veio do adaptador DeepSeek (Lane A), não do motor interno. */
  legalResearchAdapter: "deepseek" | "unavailable";
}

function isoNow(): string {
  return new Date().toISOString();
}

async function dynamicBases(): Promise<RetrievalSearchCompatiblePayload["bases"]> {
  try {
    const manifest = await getCorpusManifest();
    const out: RetrievalSearchCompatiblePayload["bases"] = [];
    for (const norm of manifest.availableNorms) {
      out.push({ key: norm.urn, label: norm.label, available: true });
    }
    for (const hint of manifest.unavailableHints) {
      out.push({
        key: hint.urnPattern,
        label: hint.label,
        available: false,
        hint: "Será disponibilizado em versões futuras",
      });
    }
    if (out.length > 0) return out;
  } catch {
    /* fallback */
  }
  return [
    { key: "cf", label: "Constituição Federal", available: true },
    { key: "adct", label: "ADCT", available: true },
  ];
}

/**
 * Monta um payload no formato esperado pelo cliente de `/api/retrieval/search`,
 * alimentado pelo `LegalResearchProvider` quando `LEGAL_RESEARCH_PROVIDER=deepseek`.
 *
 * **Não altera** a rota `GET /api/retrieval/search` — o cutover fica a cargo da Lane E.
 */
export async function buildRetrievalSearchCompatiblePayload(args: {
  workspaceId: string;
  query: string;
  topK?: number;
  caseId?: string | null;
  caseBrain?: string;
}): Promise<RetrievalSearchCompatiblePayload> {
  const providerId = process.env["LEGAL_RESEARCH_PROVIDER"]?.trim().toLowerCase() || "deepseek";
  if (providerId !== "deepseek") {
    return {
      query: args.query,
      scope: "tudo",
      caseId: args.caseId ?? null,
      layers: ["legislacao"],
      results: [],
      libraryMatches: [],
      casePins: [],
      pieceMatches: [],
      pendingLayers: ["jurisprudencia"],
      total: 0,
      bases: await dynamicBases(),
      confidence: {
        label: "Modo alternativo",
        score: 0,
        reason:
          "Adaptador de compatibilidade indisponível nesta configuração. Use o endpoint dedicado de pesquisa assistida ou ajuste o ambiente (Lane E).",
      },
      cached: false,
      legalResearchAdapter: "unavailable",
    };
  }

  const topK = args.topK ?? 8;
  const req: LegalResearchRequest = {
    workspaceId: args.workspaceId,
    ...(args.caseId ? { caseId: args.caseId } : {}),
    ...(args.caseBrain ? { caseBrain: args.caseBrain } : {}),
    query: args.query,
    resultTypes: ["LAW", "JURISPRUDENCE", "THESIS", "STRATEGY", "DRAFTING_SUPPORT"],
    maxResults: Math.min(20, Math.max(1, topK)),
    language: "pt-BR",
  };

  const provider = getLegalResearchProvider();
  const res = await provider.search(req);

  const results: RetrievalSearchCompatibleResult[] = [];

  for (const f of res.legalFoundations) {
    results.push({
      layer: "legislacao",
      id: f.id,
      text: f.excerpt || f.title,
      snippet: (f.excerpt || f.title).slice(0, 320),
      articleRef: f.article ?? f.citation ?? null,
      hierarchy: f.citation || null,
      score: Math.round(f.confidence * 100) / 100,
      source: f.title,
      article: f.article ?? null,
      excerpt: (f.excerpt || "").slice(0, 320),
      reason: f.whyRelevant || f.legalIssue,
      origin:
        "Sugestão assistida — conferir lei e doutrina em fonte oficial antes de citar.",
      referenceDate: isoNow(),
      norm: {
        id: f.id,
        urn: `urn:lex:assistant:foundation:${f.id}`,
        kind: f.type,
        identifier: f.citation || null,
        title: f.title,
        jurisdiction: "BR",
        tribunal: null,
      },
    });
  }

  for (const j of res.jurisprudenceCandidates) {
    results.push({
      layer: "legislacao",
      id: j.id,
      text: j.excerpt || j.holding || j.summary,
      snippet: (j.excerpt || j.holding || j.summary).slice(0, 320),
      articleRef: j.processNumber ?? j.court,
      hierarchy: j.classOrType,
      score: Math.round(j.confidence * 100) / 100,
      source: j.court,
      article: j.title,
      excerpt: (j.excerpt || "").slice(0, 320),
      reason: j.whyRelevant || j.legalIssue,
      origin:
        "Jurisprudência candidata — confirme a fonte (número de processo e tribunal) antes de citar.",
      referenceDate: j.judgmentDate || j.publicationDate || isoNow(),
      norm: {
        id: j.id,
        urn: `urn:lex:assistant:jurisprudence:${j.id}`,
        kind: "JURISPRUDENCE",
        identifier: j.processNumber ?? null,
        title: j.title,
        jurisdiction: "BR",
        tribunal: j.court,
      },
    });
  }

  return {
    query: args.query,
    scope: "tudo",
    caseId: args.caseId ?? null,
    layers: ["legislacao"],
    results,
    libraryMatches: [],
    casePins: [],
    pieceMatches: [],
    pendingLayers: [],
    total: results.length,
    bases: await dynamicBases(),
    confidence: {
      label: "Sugestão assistida",
      score: 0.35,
      reason:
        "Resultado sugerido por IA. Confira sempre em fonte oficial antes de citar.",
    },
    cached: false,
    legalResearchAdapter: "deepseek",
  };
}
