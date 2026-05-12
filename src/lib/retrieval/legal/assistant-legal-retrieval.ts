/**
 * Retrieval jurídico via pesquisa assistida (DeepSeek), substituindo o pipeline
 * híbrido (Qdrant/BM25/RRF). Mantém o contrato `LegalRetrievalResult` para
 * estratégia, minuta e rotas admin.
 */

import { LegalStructure, NormKind, NormJurisdiction } from "@prisma/client";
import { recordObservabilityLog } from "@/lib/observability/record";
import { getLegalResearchProvider } from "@/lib/legal-research";
import type { LegalResearchRequest, LegalFoundationType } from "@/lib/legal-research/types";
import { classifyLegalIntent, type LegalIntent } from "./intent";
import { rewriteLegalQuery } from "./rewrite";
import { buildLegalSearchPlan } from "./search-plan";
import { computeGroundingScore, groundingToConfidence } from "./scoring";
import { writeCachedResult } from "./cache";
import type {
  LegalRetrievalFilters,
  LegalRetrievalOptions,
  LegalRetrievalResult,
  LegalRetrievalTrace,
  LegalRetrievedChunk,
  ScoreBreakdown,
} from "./types";
import { loadMustIncludeChunks } from "./pinned-chunks";

const DEFAULT_TOPK = 8;

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

function normKindFromFoundationType(t: LegalFoundationType): NormKind {
  switch (t) {
    case "CONSTITUTION":
      return NormKind.CONSTITUTION;
    case "CODE":
      return NormKind.CODE;
    case "STATUTE":
    case "LAW":
    case "PRINCIPLE":
    default:
      return NormKind.ORDINARY_LAW;
  }
}

function scoreFromConfidence(c: number): ScoreBreakdown {
  const x = Math.max(0, Math.min(1, c));
  return {
    final: x,
    rrf: x * 0.5,
    dense: 0,
    bm25: 0,
    rerank: 0,
    boost: 0,
    exactArticleBoost: 0,
    topicBoost: 0,
    caseContextBoost: 0,
    pinnedBoost: 0,
    longChunkPenalty: 0,
    adctPenalty: 0,
    revokedPenalty: 0,
  };
}

function foundationToChunk(f: {
  id: string;
  type: LegalFoundationType;
  title: string;
  citation: string;
  article?: string;
  excerpt: string;
  whyRelevant: string;
  confidence: number;
}): LegalRetrievedChunk {
  const now = new Date();
  return {
    chunkId: f.id,
    text: f.excerpt || f.title,
    fullPath: f.article ? `Art. ${f.article}` : null,
    structure: LegalStructure.GENERIC,
    articleRef: f.article ?? null,
    norm: {
      id: f.id,
      urn: `urn:lex:assistant:foundation:${f.id}`,
      kind: normKindFromFoundationType(f.type),
      jurisdiction: NormJurisdiction.FEDERAL,
      title: f.title,
      identifier: f.citation || null,
      tribunal: null,
      publishedAt: null,
    },
    versionId: `asst-${f.id}`,
    validFrom: now,
    validTo: null,
    scores: scoreFromConfidence(f.confidence),
    provenance: [],
    explanation: f.whyRelevant,
  };
}

function jurisToChunk(j: {
  id: string;
  court: string;
  classOrType: string;
  processNumber?: string;
  title: string;
  excerpt: string;
  whyRelevant: string;
  confidence: number;
  judgmentDate?: string;
  publicationDate?: string;
}): LegalRetrievedChunk {
  const now = new Date();
  const kd = j.court?.toUpperCase().includes("STF")
    ? NormKind.JURISPRUDENCE_STF
    : NormKind.JURISPRUDENCE_OTHER;
  return {
    chunkId: j.id,
    text: j.excerpt || j.title,
    fullPath: j.classOrType,
    structure: LegalStructure.GENERIC,
    articleRef: j.processNumber ?? null,
    norm: {
      id: j.id,
      urn: `urn:lex:assistant:juris:${j.id}`,
      kind: kd,
      jurisdiction: NormJurisdiction.COURT,
      title: j.title,
      identifier: j.processNumber ?? null,
      tribunal: j.court,
      publishedAt: j.publicationDate ? new Date(j.publicationDate) : null,
    },
    versionId: `asst-j-${j.id}`,
    validFrom: j.judgmentDate ? new Date(j.judgmentDate) : now,
    validTo: null,
    scores: scoreFromConfidence(j.confidence),
    provenance: [],
    explanation: j.whyRelevant,
  };
}

type StageFn = <T>(
  name: string,
  fn: () => Promise<T>,
  detail?: Record<string, unknown>,
) => Promise<T>;

type MergedOpts = LegalRetrievalOptions & {
  topK: number;
  rerankPool: number;
  useGraphExpansion: boolean;
  useRerank: boolean;
  useQueryRewrite: boolean;
  includeGeneric: boolean;
  useCache: boolean;
  cacheTtlSec: number;
};

export async function runAssistantLegalRetrieval(args: {
  rawQuery: string;
  traceId: string;
  opts: MergedOpts;
  t0: number;
  cacheKey: string;
  fallbackFlags: Set<string>;
  stages: LegalRetrievalTrace["stages"];
  stage: StageFn;
}): Promise<LegalRetrievalResult> {
  const { rawQuery, traceId, opts, t0, cacheKey, stages, stage } = args;
  const flagBag = args.fallbackFlags;

  const intent = await stage("classify-intent", async () => classifyLegalIntent(rawQuery));
  const filters = deriveFiltersFromIntent(intent, opts.filters);

  const queries = opts.useQueryRewrite
    ? await stage("rewrite", async () =>
        rewriteLegalQuery(
          rawQuery,
          intent,
          opts.caseContext
            ? {
                areas: opts.caseContext.area,
                ...(opts.caseContext.problem ? { problem: opts.caseContext.problem } : {}),
              }
            : undefined,
        ),
      )
    : [rawQuery];

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

  const searchQuery = queries[0] ?? rawQuery;
  const req: LegalResearchRequest = {
    workspaceId: opts.workspaceId ?? "unknown",
    query: searchQuery.slice(0, 4000),
    resultTypes: ["LAW", "JURISPRUDENCE", "THESIS", "STRATEGY", "DRAFTING_SUPPORT"],
    maxResults: Math.min(20, Math.max(1, opts.topK || DEFAULT_TOPK)),
    language: "pt-BR",
  };

  const res = await stage("deepseek-legal-research", async () =>
    getLegalResearchProvider().search(req),
  );

  let finalChunks: LegalRetrievedChunk[] = [];
  for (const f of res.legalFoundations) {
    finalChunks.push(foundationToChunk(f));
  }
  for (const j of res.jurisprudenceCandidates) {
    finalChunks.push(jurisToChunk(j));
  }
  finalChunks = finalChunks.slice(0, opts.topK);

  if (opts.mustInclude) {
    const must = await stage("must-include", async () =>
      loadMustIncludeChunks(opts.mustInclude!, finalChunks),
    );
    if (must.length > 0) {
      const seen = new Set(finalChunks.map((c) => c.chunkId));
      const merged: LegalRetrievedChunk[] = [];
      for (const m of must) {
        if (!seen.has(m.chunkId)) {
          merged.push(m);
          seen.add(m.chunkId);
        }
      }
      finalChunks = [...merged, ...finalChunks].slice(
        0,
        Math.max(opts.topK, merged.length + opts.topK),
      );
    }
  }

  const groundingScore = computeGroundingScore({ chunks: finalChunks, intent });
  const confidence = groundingToConfidence(groundingScore);

  try {
    const { isRedisAvailable } = await import("@/lib/redis");
    if (!(await isRedisAvailable())) flagBag.add("redis_unavailable");
  } catch {
    /* ignore */
  }

  const trace: LegalRetrievalTrace = {
    traceId,
    totalLatencyMs: Date.now() - t0,
    stages,
    candidates: {
      dense: 0,
      bm25: 0,
      afterFusion: finalChunks.length,
      afterGraph: finalChunks.length,
      afterRerank: finalChunks.length,
      final: finalChunks.length,
    },
    timings: { denseMs: 0, sparseMs: 0, ftsMs: 0, fusionMs: 0 },
    cache: { hit: false, backend: null },
    fallbackFlags: Array.from(new Set([...flagBag, "assistant_deepseek_only"])).sort(),
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
      name: "retrieve_legal_context_assistant",
      latencyMs: trace.totalLatencyMs,
      payloadJson: {
        traceId,
        queryLen: rawQuery.length,
        candidates: trace.candidates,
        groundingScore,
        confidence: confidence.label,
        engine: "deepseek",
      },
      retrievalChunkIds: finalChunks.map((c) => c.chunkId),
    });
  }

  if (opts.useCache) {
    await writeCachedResult(cacheKey, result, opts.cacheTtlSec);
  }

  return result;
}
