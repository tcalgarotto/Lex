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
import { searchHybridQdrant, hybridToCandidates } from "./hybrid-qdrant";
import { fuseCandidates, indexLineage } from "./hybrid";
import { expandViaGraph } from "./graph-expansion";
import { classifyLegalIntent, type LegalIntent } from "./intent";
import { rewriteLegalQuery } from "./rewrite";
import {
  computeFinalScore,
  computeGroundingScore,
  groundingToConfidence,
} from "./scoring";
import {
  buildCacheKey,
  getCorpusContentHash,
  readCachedResult,
  writeCachedResult,
} from "./cache";
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
  hybrid: 5_000,
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

  // 1) Hybrid Qdrant (dense + sparse + RRF server-side ou in-code).
  //    Substitui o loop dense puro. Se a Query API rejeitar (servidor antigo,
  //    sem sparse), o searchHybridQdrant cai pra dense_only internamente.
  //    Em último caso (qdrant offline), exception é capturada e flag de
  //    fallback é registrada para o trace.
  const denseLists: RetrievalCandidate[][] = [];
  const denseLineage: ChunkWithLineage[] = [];
  let denseCount = 0;
  let hybridNativeUsed = false;
  let sparseUnavailable = false;
  let denseMsAcc = 0;
  let sparseMsAcc = 0;
  let fusionMsHybrid = 0;
  for (const q of queries.slice(0, 3)) {
    try {
      const hybridRes = await stage(
        "hybrid",
        () =>
          withTimeout(
            searchHybridQdrant({ query: q, limit: 24, intent, filters }),
            STAGE_TIMEOUT_MS.hybrid,
            "hybrid",
          ),
        { variant: q.slice(0, 80) },
      );
      denseCount += hybridRes.results.length;
      denseLineage.push(...hybridRes.results.map((r) => r.chunk));
      denseLists.push(hybridToCandidates(hybridRes.results));
      hybridNativeUsed = hybridNativeUsed || hybridRes.trace.hybridNativeUsed;
      if (hybridRes.trace.sparseUnavailable) sparseUnavailable = true;
      denseMsAcc += hybridRes.trace.denseMs;
      sparseMsAcc += hybridRes.trace.sparseMs;
      fusionMsHybrid += hybridRes.trace.fusionMs;
    } catch (err) {
      const msg = (err as Error).message;
      fallbackFlags.add("hybrid_unavailable");
      if (/timeout/i.test(msg)) fallbackFlags.add("hybrid_timeout");
      if (/qdrant|ECONNREFUSED|ENOTFOUND/i.test(msg)) fallbackFlags.add("qdrant_unavailable");
      log.warnOnce(`hybrid:${msg.slice(0, 40)}`, `hybrid indisponível: ${msg}`);
      // Última cartada: tenta dense puro (caso hybrid esteja falhando mas
      // dense funcione — improvável, mas não custa).
      try {
        const denseRes = await stage(
          "dense-after-hybrid-fail",
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
        sparseUnavailable = true;
      } catch {
        fallbackFlags.add("dense_unavailable");
      }
      break;
    }
  }
  if (sparseUnavailable) fallbackFlags.add("sparse_unavailable");
  if (!hybridNativeUsed && denseCount > 0 && !sparseUnavailable) {
    fallbackFlags.add("hybrid_native_unavailable");
  }

  // 2) BM25: por variante
  const bm25Lists: RetrievalCandidate[][] = [];
  const bm25Lineage: ChunkWithLineage[] = [];
  let bm25Count = 0;
  let ftsMs = 0;
  for (const q of queries.slice(0, 3)) {
    try {
      const tFts = Date.now();
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
      ftsMs += Date.now() - tFts;
      bm25Count += bm25Res.length;
      bm25Lineage.push(...bm25Res.map((d) => d.chunk));
      bm25Lists.push(bm25ToCandidates(bm25Res));
    } catch (err) {
      log.warn(`bm25 err: ${(err as Error).message}`);
    }
  }

  // Fallback "soften filters" se zerou — usa hybrid também (mantém sparse).
  if (
    denseCount === 0 &&
    bm25Count === 0 &&
    Object.keys(filters).length > 0 &&
    !fallbackFlags.has("hybrid_unavailable") &&
    !fallbackFlags.has("dense_unavailable")
  ) {
    const soft = softenFilters(filters);
    try {
      const fallback = await stage("hybrid-fallback", () =>
        withTimeout(
          searchHybridQdrant({ query: rawQuery, limit: 24, intent, filters: soft }),
          STAGE_TIMEOUT_MS.hybrid,
          "hybrid-fallback",
        ),
      );
      denseCount += fallback.results.length;
      denseLineage.push(...fallback.results.map((r) => r.chunk));
      denseLists.push(hybridToCandidates(fallback.results));
      denseMsAcc += fallback.trace.denseMs;
      sparseMsAcc += fallback.trace.sparseMs;
      fusionMsHybrid += fallback.trace.fusionMs;
    } catch (err) {
      log.warnOnce("hybrid-fallback", `hybrid-fallback indisponível: ${(err as Error).message}`);
      fallbackFlags.add("hybrid_unavailable");
    }
  }

  // 3) Fusão RRF
  const tFuseFinal = Date.now();
  const fused = await stage(
    "fuse",
    async () => fuseCandidates([...denseLists, ...bm25Lists]),
  );
  const fusionMsFinal = Date.now() - tFuseFinal;

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
      rawQuery,
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
  let finalChunks = ranked.slice(0, opts.topK);

  // F4 — mustInclude: garante que pinned sources apareçam no topo, mesmo
  // que o ranking natural não as eleja. Faz fetch dos faltantes.
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
      // Pinned no topo, depois ranqueados naturais (até topK total).
      finalChunks = [...merged, ...finalChunks].slice(0, Math.max(opts.topK, merged.length + opts.topK));
    }
  }

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
    timings: {
      denseMs: denseMsAcc,
      sparseMs: sparseMsAcc,
      ftsMs,
      fusionMs: fusionMsHybrid + fusionMsFinal,
    },
    cache: { hit: false, backend: null },
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

/**
 * F4 — Carrega chunks marcados como "mustInclude" e que ainda não estejam
 * presentes no ranking final. Faz uma única query Postgres com lineage
 * completa para alimentar o draft.
 */
async function loadMustIncludeChunks(
  must: NonNullable<LegalRetrievalOptions["mustInclude"]>,
  already: LegalRetrievedChunk[],
): Promise<LegalRetrievedChunk[]> {
  const targetChunkIds = (must.chunkIds ?? []).filter(Boolean);
  const targetNormUrns = (must.normUrns ?? []).filter(Boolean);
  if (targetChunkIds.length === 0 && targetNormUrns.length === 0) return [];

  const alreadyChunkIds = new Set(already.map((c) => c.chunkId));
  const alreadyNormUrns = new Set(already.map((c) => c.norm.urn));

  const missingChunkIds = targetChunkIds.filter((id) => !alreadyChunkIds.has(id));
  const missingNormUrns = targetNormUrns.filter((u) => !alreadyNormUrns.has(u));
  if (missingChunkIds.length === 0 && missingNormUrns.length === 0) return [];

  const { prisma } = await import("@/lib/prisma");
  const out: LegalRetrievedChunk[] = [];

  const includeShape = {
    norm: {
      select: {
        id: true,
        urn: true,
        kind: true,
        jurisdiction: true,
        title: true,
        identifier: true,
        tribunal: true,
        publishedAt: true,
      },
    },
    version: {
      select: { id: true, validFrom: true, validTo: true },
    },
  } as const;

  if (missingChunkIds.length > 0) {
    const rows = await prisma.legalChunk.findMany({
      where: { id: { in: missingChunkIds } },
      include: includeShape,
    });
    for (const r of rows) {
      out.push(toRetrievedChunk(r, "pinned-chunk"));
    }
  }

  if (missingNormUrns.length > 0) {
    // Pega o 1º chunk significativo (não-genérico) de cada norma faltante,
    // priorizando ARTICLE / PARAGRAPH / INCISO sobre PREAMBLE / GENERIC.
    const rows = await prisma.legalChunk.findMany({
      where: {
        norm: { urn: { in: missingNormUrns } },
        version: { validTo: null },
      },
      include: includeShape,
      orderBy: [{ structure: "asc" }, { ordinal: "asc" }],
      take: missingNormUrns.length * 2,
    });
    const perUrn = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!perUrn.has(r.norm.urn)) perUrn.set(r.norm.urn, r);
    }
    for (const r of perUrn.values()) {
      out.push(toRetrievedChunk(r, "pinned-norm"));
    }
  }
  return out;
}

type PinnedChunkRow = {
  id: string;
  text: string;
  fullPath: string | null;
  structure: import("@prisma/client").LegalStructure;
  articleRef: string | null;
  normVersionId: string;
  version: { id: string; validFrom: Date; validTo: Date | null };
  norm: {
    id: string;
    urn: string;
    kind: import("@prisma/client").NormKind;
    jurisdiction: import("@prisma/client").NormJurisdiction;
    title: string;
    identifier: string | null;
    tribunal: string | null;
    publishedAt: Date | null;
  };
};

function toRetrievedChunk(
  r: PinnedChunkRow,
  origin: "pinned-chunk" | "pinned-norm",
): LegalRetrievedChunk {
  return {
    chunkId: r.id,
    text: r.text,
    fullPath: r.fullPath,
    structure: r.structure,
    articleRef: r.articleRef,
    norm: {
      id: r.norm.id,
      urn: r.norm.urn,
      kind: r.norm.kind,
      jurisdiction: r.norm.jurisdiction,
      title: r.norm.title,
      identifier: r.norm.identifier,
      tribunal: r.norm.tribunal,
      publishedAt: r.norm.publishedAt,
    },
    versionId: r.normVersionId,
    validFrom: r.version.validFrom,
    validTo: r.version.validTo,
    scores: { final: 1.0, rrf: 1.0 },
    provenance: [],
    explanation: `Pinned (${origin}) — incluído por mustInclude do caso.`,
  };
}

export type {
  LegalRetrievalResult,
  LegalRetrievedChunk,
  LegalRetrievalOptions,
  LegalRetrievalFilters,
} from "./types";
export { classifyLegalIntent } from "./intent";
export { rewriteLegalQuery } from "./rewrite";
