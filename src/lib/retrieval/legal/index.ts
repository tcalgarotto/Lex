/**
 * Retrieval jurídico enterprise — orquestrador.
 *
 * Pipeline:
 *   1. (cache lookup)
 *   2. classifyLegalIntent(query)
 *   3. rewriteLegalQuery(query, intent) → variantes
 *   4. dense (Qdrant nas collections corpus, com filtros do intent)
 *   5. bm25 (PG FTS com filtros do intent)
 *   6. RRF fusion (multi-query: dense + bm25 por variante)
 *   7. graph expansion (1-hop)
 *   8. cross-encoder rerank (BGE-v2-m3) sobre rerankPool
 *   9. boosts (kind, structure, recency, intent alignment)
 *   10. grounding + confidence
 *   11. observabilityLog + cache write
 *
 * Cada estágio é cronometrado e contribui pro `trace`. Falhas em estágios
 * opcionais (rerank, graph) degradam graciosamente.
 */

import { randomUUID } from "node:crypto";
import { rerankDocuments } from "@/lib/ai/reranker";
import { recordObservabilityLog } from "@/lib/observability/record";
import { getLogger } from "@/lib/logger";
import { searchBm25, bm25ToCandidates } from "./bm25";
import { searchDense, denseToCandidates } from "./dense";
import { fuseCandidates, indexLineage } from "./hybrid";
import { expandViaGraph } from "./graph-expansion";
import { classifyLegalIntent, type LegalIntent } from "./intent";
import { rewriteLegalQuery } from "./rewrite";
import {
  computeFinalScore,
  computeGroundingScore,
  groundingToConfidence,
} from "./scoring";
import { buildCacheKey, readCachedResult, writeCachedResult } from "./cache";
import type {
  ChunkWithLineage,
  LegalRetrievalFilters,
  LegalRetrievalOptions,
  LegalRetrievalResult,
  LegalRetrievalTrace,
  LegalRetrievedChunk,
  RetrievalCandidate,
  RetrievalProvenance,
} from "./types";

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

/** Timeouts por estágio (ms). Estágios opcionais falham rápido em vez de pendurar a request. */
const STAGE_TIMEOUT_MS = {
  dense: 4_000,
  rerank: 3_000,
  graph: 1_500,
} as const;

const log = getLogger("lex.retrieval");

/**
 * Wrapper genérico de timeout que rejeita a promessa com erro nomeado.
 * Usado apenas em estágios opcionais (dense/rerank/graph). BM25 não tem timeout
 * porque é a coluna fallback.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms),
    ),
  ]);
}

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

/**
 * Versão "soft" dos filtros: tira filtros muito restritivos quando intent é
 * fraco — evita zerar candidatos. Usada como fallback se 1ª passada vier vazia.
 */
function softenFilters(f: LegalRetrievalFilters): LegalRetrievalFilters {
  const out: LegalRetrievalFilters = {};
  if (f.asOf) out.asOf = f.asOf;
  if (f.jurisdictions) out.jurisdictions = f.jurisdictions;
  return out;
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
  const cacheKey = buildCacheKey({ query: rawQuery, ...(opts.filters ? { filters: opts.filters } : {}), options: opts });

  /** Flags determinísticas que viram parte do trace pra UI/audit. */
  const fallbackFlags: Set<string> = new Set();

  if (opts.useCache) {
    const cached = await readCachedResult(cacheKey);
    if (cached) {
      cached.cached = true;
      return cached;
    }
  }

  const intent = await stage("classify-intent", async () => classifyLegalIntent(rawQuery));
  const filters = deriveFiltersFromIntent(intent, opts.filters);

  const queries = opts.useQueryRewrite
    ? await stage("rewrite", async () => rewriteLegalQuery(rawQuery, intent))
    : [rawQuery];

  // 1) Dense: por variante (timeout curto; falha cai para BM25 sem travar request).
  const denseLists: RetrievalCandidate[][] = [];
  const denseLineage: ChunkWithLineage[] = [];
  let denseCount = 0;
  for (const q of queries.slice(0, 3)) {
    try {
      const denseRes = await stage(
        "dense",
        () =>
          withTimeout(
            searchDense({ query: q, limit: 24, filters }),
            STAGE_TIMEOUT_MS.dense,
            "dense",
          ),
        { variant: q.slice(0, 80) },
      );
      denseCount += denseRes.length;
      denseLineage.push(...denseRes.map((d) => d.chunk));
      denseLists.push(denseToCandidates(denseRes));
    } catch (err) {
      const msg = (err as Error).message;
      fallbackFlags.add("dense_unavailable");
      if (/timeout/i.test(msg)) fallbackFlags.add("dense_timeout");
      if (/qdrant|ECONNREFUSED|ENOTFOUND/i.test(msg)) fallbackFlags.add("qdrant_unavailable");
      log.warnOnce(`dense:${msg.slice(0, 40)}`, `dense indisponível: ${msg}`);
      break;
    }
  }

  // 2) BM25: por variante
  const bm25Lists: RetrievalCandidate[][] = [];
  const bm25Lineage: ChunkWithLineage[] = [];
  let bm25Count = 0;
  for (const q of queries.slice(0, 3)) {
    try {
      const bm25Res = await stage(
        "bm25",
        () =>
          searchBm25({
            query: q,
            limit: 24,
            filters,
            ...(opts.includeGeneric !== undefined ? { includeGeneric: opts.includeGeneric } : {}),
          }),
        { variant: q.slice(0, 80) },
      );
      bm25Count += bm25Res.length;
      bm25Lineage.push(...bm25Res.map((d) => d.chunk));
      bm25Lists.push(bm25ToCandidates(bm25Res));
    } catch (err) {
      log.warn(`bm25 err: ${(err as Error).message}`);
    }
  }

  // Fallback "soften filters" se zerou.
  if (denseCount === 0 && bm25Count === 0 && Object.keys(filters).length > 0 && !fallbackFlags.has("dense_unavailable")) {
    const soft = softenFilters(filters);
    try {
      const fallback = await stage("dense-fallback", () =>
        withTimeout(
          searchDense({ query: rawQuery, limit: 24, filters: soft }),
          STAGE_TIMEOUT_MS.dense,
          "dense-fallback",
        ),
      );
      denseCount += fallback.length;
      denseLineage.push(...fallback.map((d) => d.chunk));
      denseLists.push(denseToCandidates(fallback));
    } catch (err) {
      log.warnOnce("dense-fallback", `dense-fallback indisponível: ${(err as Error).message}`);
      fallbackFlags.add("dense_unavailable");
    }
  }

  // 3) Fusão RRF
  const fused = await stage(
    "fuse",
    async () => fuseCandidates([...denseLists, ...bm25Lists]),
  );

  // 4) Expansão por grafo (opcional)
  let graphAdded: ChunkWithLineage[] = [];
  let graphCandidates: RetrievalCandidate[] = [];
  if (opts.useGraphExpansion && fused.length > 0) {
    try {
      const seenChunkIds = new Set(fused.map((f) => f.chunkId));
      const exp = await stage("graph-expansion", () =>
        withTimeout(
          expandViaGraph({
            seeds: fused.slice(0, 8).map((f) => ({ chunkId: f.chunkId, rrfScore: f.rrfScore })),
            excludeChunkIds: seenChunkIds,
          }),
          STAGE_TIMEOUT_MS.graph,
          "graph",
        ),
      );
      graphAdded = exp.added;
      graphCandidates = exp.candidates;
    } catch (err) {
      log.warnOnce(`graph:${(err as Error).message.slice(0, 40)}`, `graph indisponível: ${(err as Error).message}`);
      fallbackFlags.add("graph_skipped");
    }
  }

  // Re-fusão incluindo grafo
  const fusedWithGraph = graphCandidates.length > 0
    ? await stage("fuse-with-graph", async () =>
        fuseCandidates([...denseLists, ...bm25Lists, graphCandidates]),
      )
    : fused;

  const lineage = indexLineage(denseLineage, bm25Lineage, graphAdded);

  // 5) Rerank cross-encoder no top-N
  const poolIds = fusedWithGraph.slice(0, opts.rerankPool).map((f) => f.chunkId);
  const docsForRerank = poolIds
    .map((id) => {
      const c = lineage.get(id);
      if (!c) return null;
      return { id, text: c.text };
    })
    .filter((d): d is { id: string; text: string } => d !== null);

  let rerankOrder: string[] = poolIds;
  const rerankScores = new Map<string, number>();
  if (opts.useRerank && docsForRerank.length > 0) {
    try {
      const reranked = await stage("rerank", () =>
        withTimeout(
          rerankDocuments(rawQuery, docsForRerank, opts.rerankPool),
          STAGE_TIMEOUT_MS.rerank,
          "rerank",
        ),
      );
      rerankOrder = reranked.map((r) => r.id);
      // Note: o rerankDocuments atual não devolve scores numéricos; usamos
      // 1 - i/N como proxy estável.
      rerankOrder.forEach((id, i) => {
        rerankScores.set(id, 1 - i / Math.max(1, rerankOrder.length));
      });
    } catch (err) {
      log.warnOnce(`rerank:${(err as Error).message.slice(0, 40)}`, `rerank indisponível: ${(err as Error).message}`);
      fallbackFlags.add("rerank_skipped");
    }
  }

  // 6) Aplica boosts e score final
  const ranked: LegalRetrievedChunk[] = [];
  for (const id of rerankOrder) {
    const lin = lineage.get(id);
    if (!lin) continue;
    const fusion = fusedWithGraph.find((f) => f.chunkId === id);
    const rrf = fusion?.rrfScore ?? 0;
    const provenance = (fusion?.provenance ?? []) as RetrievalProvenance[];
    const rawScores = fusion?.rawScores ?? {};

    const finalArgs: Parameters<typeof computeFinalScore>[0] = {
      rrfScore: rrf,
      rawScores,
      chunk: lin,
      intent,
    };
    const rs = rerankScores.get(id);
    if (rs !== undefined) finalArgs.rerankScore = rs;
    const { breakdown, explanation } = computeFinalScore(finalArgs);

    const allProv: RetrievalProvenance[] = [...provenance];
    if (opts.useRerank) allProv.push("rerank");

    ranked.push({
      chunkId: id,
      text: lin.text,
      fullPath: lin.fullPath,
      structure: lin.structure,
      articleRef: lin.articleRef,
      norm: {
        id: lin.norm.id,
        urn: lin.norm.urn,
        kind: lin.norm.kind,
        jurisdiction: lin.norm.jurisdiction,
        title: lin.norm.title,
        identifier: lin.norm.identifier,
        tribunal: lin.norm.tribunal,
        publishedAt: lin.norm.publishedAt,
      },
      versionId: lin.versionId,
      validFrom: lin.validFrom,
      validTo: lin.validTo,
      scores: breakdown,
      provenance: Array.from(new Set(allProv)),
      explanation,
    });
  }

  // Reordena por score final (boosts podem mudar a ordem do rerank).
  ranked.sort((a, b) => b.scores.final - a.scores.final);
  const finalChunks = ranked.slice(0, opts.topK);

  const groundingScore = computeGroundingScore({ chunks: finalChunks, intent });
  const confidence = groundingToConfidence(groundingScore);

  // Sinaliza Redis indisponível como fallback flag (informativo, não bloqueia).
  // Importamos lazy para não criar dependência circular nem custo em hot path.
  try {
    const { isRedisAvailable } = await import("@/lib/redis");
    if (!(await isRedisAvailable())) fallbackFlags.add("redis_unavailable");
  } catch {
    /* ignore */
  }

  const trace: LegalRetrievalTrace = {
    traceId,
    totalLatencyMs: Date.now() - t0,
    stages,
    candidates: {
      dense: denseCount,
      bm25: bm25Count,
      afterFusion: fused.length,
      afterGraph: fusedWithGraph.length,
      afterRerank: rerankOrder.length,
      final: finalChunks.length,
    },
    ...(fallbackFlags.size > 0 ? { fallbackFlags: Array.from(fallbackFlags).sort() } : {}),
  };

  const result: LegalRetrievalResult = {
    query: rawQuery,
    rewrittenQueries: queries,
    filters,
    intent,
    chunks: finalChunks,
    groundingScore,
    confidence,
    trace,
    cached: false,
  };

  // Log apenas quando temos workspaceId real (FK ObservabilityLog_workspaceId_fkey).
  if (opts.workspaceId) {
    recordObservabilityLog({
      workspaceId: opts.workspaceId,
      kind: "retrieval.legal",
      name: "retrieve_legal_context",
      latencyMs: trace.totalLatencyMs,
      payloadJson: {
        traceId,
        candidates: trace.candidates,
        groundingScore,
        confidence: confidence.label,
        intent: intent.signals,
      },
      retrievalChunkIds: finalChunks.map((c) => c.chunkId),
    });
  }

  if (opts.useCache) {
    await writeCachedResult(cacheKey, result, opts.cacheTtlSec);
  }

  return result;
}

export type {
  LegalRetrievalResult,
  LegalRetrievedChunk,
  LegalRetrievalOptions,
  LegalRetrievalFilters,
} from "./types";
export { classifyLegalIntent } from "./intent";
export { rewriteLegalQuery } from "./rewrite";
