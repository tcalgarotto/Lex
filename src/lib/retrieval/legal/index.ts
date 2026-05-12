/**
 * Retrieval jurídico — orquestrador fino sobre pesquisa assistida (DeepSeek).
 *
 * 1. Cache (opcional) 2. Curto-circuito se retrieval jurídico desligado
 * 3. Pipeline assistido (`runAssistantLegalRetrieval`) com intent + rewrite + grounding.
 */

import { randomUUID } from "node:crypto";
import { recordObservabilityLog } from "@/lib/observability/record";
import { getEnv } from "@/lib/env";
import { classifyLegalIntent, type LegalIntent } from "./intent";
import { buildLegalSearchPlan } from "./search-plan";
import { computeGroundingScore, groundingToConfidence } from "./scoring";
import {
  buildCacheKey,
  getCorpusContentHash,
  readCachedResult,
} from "./cache";
import type {
  LegalRetrievalFilters,
  LegalRetrievalOptions,
  LegalRetrievalResult,
  LegalRetrievalTrace,
  LegalRetrievedChunk,
} from "./types";
import { runAssistantLegalRetrieval } from "./assistant-legal-retrieval";

const DEFAULTS = {
  topK: 8,
  rerankPool: 32,
  useGraphExpansion: true,
  useRerank: true,
  useCache: true,
  cacheTtlSec: 300,
  useQueryRewrite: true,
  includeGeneric: false,
};

function deriveFiltersFromIntent(
  intent: LegalIntent,
  override?: LegalRetrievalFilters,
): LegalRetrievalFilters {
  const f: LegalRetrievalFilters = {};
  if (intent.preferredKinds.length > 0) f.kinds = intent.preferredKinds;
  if (intent.preferredJurisdictions.length > 0) f.jurisdictions = intent.preferredJurisdictions;
  if (intent.tribunals.length > 0) f.tribunals = intent.tribunals;
  if (intent.urns.length > 0) f.normUrns = intent.urns;
  if (intent.articleRefs.length > 0) f.articleRefs = intent.articleRefs;
  if (intent.asOf) f.asOf = intent.asOf;
  return { ...f, ...override };
}

type LegalCorpusShortCircuitReason = "legal_retrieval_disabled";

function getLegalCorpusShortCircuitReason(): LegalCorpusShortCircuitReason | null {
  return getEnv().ENABLE_LEGAL_RETRIEVAL ? null : "legal_retrieval_disabled";
}

type MergedLegalOpts = typeof DEFAULTS & LegalRetrievalOptions;

function buildShortCircuitLegalRetrieval(
  rawQuery: string,
  traceId: string,
  opts: MergedLegalOpts,
  t0: number,
  reasonFlag: LegalCorpusShortCircuitReason,
): LegalRetrievalResult {
  const intent = classifyLegalIntent(rawQuery);
  const filters = deriveFiltersFromIntent(intent, opts.filters);
  const queries = [rawQuery];
  const searchPlan = buildLegalSearchPlan({
    query: rawQuery,
    intent,
    filters,
    options: {
      topK: opts.topK,
      rerankPool: opts.rerankPool,
      useGraphExpansion: opts.useGraphExpansion,
      useRerank: opts.useRerank,
      useQueryRewrite: opts.useQueryRewrite,
      includeGeneric: opts.includeGeneric,
    },
  });
  const stages: LegalRetrievalTrace["stages"] = [
    { stage: "short-circuit-corpus", latencyMs: 0, detail: { reason: reasonFlag } },
  ];
  const finalChunks: LegalRetrievedChunk[] = [];
  const groundingScore = computeGroundingScore({ chunks: finalChunks, intent });
  const confidence = groundingToConfidence(groundingScore);

  const trace: LegalRetrievalTrace = {
    traceId,
    totalLatencyMs: Date.now() - t0,
    stages,
    candidates: {
      dense: 0,
      bm25: 0,
      afterFusion: 0,
      afterGraph: 0,
      afterRerank: 0,
      final: 0,
    },
    timings: {
      denseMs: 0,
      sparseMs: 0,
      ftsMs: 0,
      fusionMs: 0,
    },
    cache: { hit: false, backend: null },
    fallbackFlags: [reasonFlag],
  };

  const result: LegalRetrievalResult = {
    query: rawQuery,
    rewrittenQueries: queries,
    filters,
    intent,
    searchPlan,
    chunks: finalChunks,
    groundingScore,
    confidence,
    trace,
    cached: false,
  };

  if (opts.workspaceId) {
    recordObservabilityLog({
      workspaceId: opts.workspaceId,
      traceId,
      kind: "retrieval.legal",
      name: "retrieve_legal_context_short_circuit",
      latencyMs: trace.totalLatencyMs,
      payloadJson: {
        traceId,
        queryLen: rawQuery.length,
        reason: reasonFlag,
        candidates: trace.candidates,
      },
      retrievalChunkIds: [],
    });
  }

  return result;
}

export async function retrieveLegalContext(
  rawQuery: string,
  options: LegalRetrievalOptions = {},
): Promise<LegalRetrievalResult> {
  const traceId = options.traceId ?? randomUUID();
  const t0 = Date.now();
  const stages: LegalRetrievalTrace["stages"] = [];
  const stage = async <T>(name: string, fn: () => Promise<T>, detail?: Record<string, unknown>): Promise<T> => {
    const s = Date.now();
    try {
      const r = await fn();
      stages.push({ stage: name, latencyMs: Date.now() - s, detail });
      return r;
    } catch (err) {
      stages.push({
        stage: name,
        latencyMs: Date.now() - s,
        detail: { ...detail, error: (err as Error).message },
      });
      throw err;
    }
  };

  const opts = { ...DEFAULTS, ...options };

  // Segurança/LGPD: se houver contexto de caso (ex.: `problem` do Case Brain),
  // evitamos cache compartilhado. O benefício de cache aqui é pequeno e o risco
  // de poluição/leak cross-tenant é alto.
  if (opts.caseContext) {
    opts.useCache = false;
  }

  const shortReason = getLegalCorpusShortCircuitReason();
  if (shortReason) {
    return buildShortCircuitLegalRetrieval(rawQuery, traceId, opts, t0, shortReason);
  }

  // `corpusContentHash` invalida o cache automaticamente quando o corpus
  // jurídico muda (nova ingest, revogação). Lazy + cached por 60s.
  const corpusContentHash = opts.useCache ? await getCorpusContentHash() : undefined;
  const cacheKey = buildCacheKey({
    query: rawQuery,
    ...(opts.filters ? { filters: opts.filters } : {}),
    options: opts,
    ...(corpusContentHash ? { corpusContentHash } : {}),
  });

  /** Flags determinísticas que viram parte do trace pra UI/audit. */
  const fallbackFlags: Set<string> = new Set();

  if (opts.useCache) {
    const cached = await readCachedResult(cacheKey);
    if (cached) {
      cached.cached = true;
      // Marca cache hit no trace (preserva backend reportado pelo cache layer).
      if (cached.trace) {
        cached.trace.cache = {
          hit: true,
          backend: cached.trace.cache?.backend ?? "lru",
        };
      }
      return cached;
    }
  }

  return runAssistantLegalRetrieval({
    rawQuery,
    traceId,
    opts: opts as MergedLegalOpts,
    t0,
    cacheKey,
    fallbackFlags,
    stages,
    stage,
  });

}


export type {
  LegalRetrievalResult,
  LegalRetrievedChunk,
  LegalRetrievalOptions,
  LegalRetrievalFilters,
} from "./types";
export { classifyLegalIntent } from "./intent";
export { rewriteLegalQuery } from "./rewrite";
