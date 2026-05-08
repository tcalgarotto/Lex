/**
 * Hybrid retrieval (dense + sparse) sobre as collections do corpus jurídico.
 *
 * Estratégia:
 *  1. **Caminho preferido (server-side fusion)** — Qdrant Query API com
 *     `prefetch` para sparse (50) + dense (50) e `query: { fusion: "rrf" }`.
 *     Resultado já vem fundido. Suportado em Qdrant ≥ 1.10.
 *  2. **Fallback (in-code fusion)** — duas chamadas paralelas (`searchDense`
 *     já existente + `client.query` com `using: "keywords"`) e RRF in-code
 *     usando `fuseCandidates` ([./hybrid.ts](./hybrid.ts)). Disparado quando
 *     a Query API rejeita (servidor antigo, sparse vector ausente, etc.).
 *
 * Reusa `searchDense.ts` para resolver lineage (mesmo path Postgres).
 *
 * Lineage retornada é compatível com `LegalRetrievedChunk`/`searchDense`
 * para que o orquestrador possa trocar engine sem rebobinar todo o pipeline.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { type LegalChunk, type LegalNorm, type LegalNormVersion } from "@prisma/client";
import { embedQuery } from "@/lib/ai/embeddings";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getLogger } from "@/lib/logger";
import {
  collectionForKind,
  CORPUS_COLLECTIONS,
  DENSE_VECTOR_NAME,
  SPARSE_VECTOR_NAME,
  type CorpusCollection,
} from "@/lib/corpus/qdrant-collections";
import { buildCorpusNormsFilter } from "./qdrant-corpus-filter";
import { buildLegalSparseQuery } from "./sparse";
import type { LegalIntent } from "./intent";
import type {
  ChunkWithLineage,
  LegalRetrievalFilters,
  RetrievalCandidate,
} from "./types";

const log = getLogger("lex.retrieval.hybrid");

export type HybridResult = {
  chunk: ChunkWithLineage;
  rawScore: number;
  /** Origem efetiva — "hybrid" para fusion server-side, "dense_only" se sparse falhou. */
  source: "hybrid" | "dense_only" | "sparse_only";
};

export type SearchHybridArgs = {
  query: string;
  limit: number;
  intent?: LegalIntent;
  filters?: LegalRetrievalFilters;
  /** Se passado, restringe a busca a essas collections. */
  collectionsOverride?: CorpusCollection[];
};

export type SearchHybridResult = {
  results: HybridResult[];
  /** Métricas para o trace. */
  trace: {
    /** True se a Query API nativa do Qdrant foi usada com fusion=rrf. */
    hybridNativeUsed: boolean;
    /** True se sparse não pôde ser executado (collection legacy ou erro). */
    sparseUnavailable: boolean;
    denseMs: number;
    sparseMs: number;
    fusionMs: number;
    totalMs: number;
  };
};

function qdrantClient(): QdrantClient {
  const env = getEnv();
  return new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY || undefined });
}

export function pickCollections(filters?: LegalRetrievalFilters): CorpusCollection[] {
  const kinds = filters?.kinds ?? [];
  if (kinds.length === 0) return Object.values(CORPUS_COLLECTIONS);
  const set = new Set<CorpusCollection>();
  for (const k of kinds) set.add(collectionForKind(k));
  return Array.from(set);
}

/** Alias — mesmo filtro que `buildQdrantFilter` em dense.ts. */
export const buildHybridFilter = buildCorpusNormsFilter;

type QdrantHit = { id: string; score: number; payload: Record<string, unknown> | undefined };

/**
 * Tenta a Query API nativa com prefetch+fusion=rrf. Retorna `null` se
 * a API não for suportada (servidor antigo) — caller cai pra fallback.
 */
async function tryNativeHybrid(
  client: QdrantClient,
  collection: string,
  args: {
    denseVec: number[];
    sparseVec: { indices: number[]; values: number[] };
    filter: Record<string, unknown>;
    limit: number;
  },
): Promise<{ hits: QdrantHit[]; ms: number } | null> {
  const t0 = Date.now();
  try {
    const res = await client.query(collection, {
      prefetch: [
        {
          query: { indices: args.sparseVec.indices, values: args.sparseVec.values } as never,
          using: SPARSE_VECTOR_NAME,
          limit: 50,
          filter: args.filter as never,
        },
        {
          query: args.denseVec as never,
          using: DENSE_VECTOR_NAME,
          limit: 50,
          filter: args.filter as never,
        },
      ],
      // RRF fusion server-side.
      query: { fusion: "rrf" } as never,
      limit: args.limit,
      with_payload: true,
    });
    const hits: QdrantHit[] = (res.points ?? []).map((p) => ({
      id: String(p.id),
      score: typeof p.score === "number" ? p.score : 0,
      payload: (p.payload as Record<string, unknown>) ?? undefined,
    }));
    return { hits, ms: Date.now() - t0 };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    // Causas conhecidas: server < 1.10, named vector ausente, sparse não
    // configurado. Nesses casos, caímos pro fallback in-code.
    log.warnOnce(
      `hybrid-native:${msg.slice(0, 60)}`,
      `Qdrant Query API não disponível, usando fallback: ${msg}`,
    );
    return null;
  }
}

/**
 * Caminho fallback: dense + sparse separados via `client.query` (sem prefetch),
 * fundindo em código. Retorna null se ambos falharem.
 */
async function tryParallelHybrid(
  client: QdrantClient,
  collection: string,
  args: {
    denseVec: number[];
    sparseVec: { indices: number[]; values: number[] };
    filter: Record<string, unknown>;
    limit: number;
  },
): Promise<{
  denseHits: QdrantHit[];
  sparseHits: QdrantHit[];
  denseMs: number;
  sparseMs: number;
  sparseUnavailable: boolean;
}> {
  const tDense = Date.now();
  let denseHits: QdrantHit[] = [];
  try {
    const res = await client.query(collection, {
      query: args.denseVec as never,
      using: DENSE_VECTOR_NAME,
      filter: args.filter as never,
      limit: 50,
      with_payload: true,
    });
    denseHits = (res.points ?? []).map((p) => ({
      id: String(p.id),
      score: typeof p.score === "number" ? p.score : 0,
      payload: (p.payload as Record<string, unknown>) ?? undefined,
    }));
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    // Collection legada: vetor único sem nome.
    if (/bad request|400|unknown vector|not found/i.test(msg)) {
      try {
        const res = await client.search(collection, {
          vector: args.denseVec,
          filter: args.filter as never,
          limit: 50,
          with_payload: true,
        });
        denseHits = res.map((p) => ({
          id: String(p.id),
          score: typeof p.score === "number" ? p.score : 0,
          payload: (p.payload as Record<string, unknown>) ?? undefined,
        }));
      } catch (e2) {
        log.warn(`hybrid-fallback dense legacy search err: ${(e2 as Error).message}`);
      }
    } else {
      log.warn(`hybrid-fallback dense err: ${msg}`);
    }
  }
  const denseMs = Date.now() - tDense;

  const tSparse = Date.now();
  let sparseHits: QdrantHit[] = [];
  let sparseUnavailable = false;
  try {
    const res = await client.query(collection, {
      query: { indices: args.sparseVec.indices, values: args.sparseVec.values } as never,
      using: SPARSE_VECTOR_NAME,
      filter: args.filter as never,
      limit: 50,
      with_payload: true,
    });
    sparseHits = (res.points ?? []).map((p) => ({
      id: String(p.id),
      score: typeof p.score === "number" ? p.score : 0,
      payload: (p.payload as Record<string, unknown>) ?? undefined,
    }));
  } catch (err) {
    sparseUnavailable = true;
    log.warnOnce(
      `hybrid-fallback-sparse:${(err as Error).message.slice(0, 60)}`,
      `Sparse query falhou: ${(err as Error).message}`,
    );
  }
  const sparseMs = Date.now() - tSparse;

  return { denseHits, sparseHits, denseMs, sparseMs, sparseUnavailable };
}

/**
 * RRF in-code para [denseHits, sparseHits]. K=60 (default literatura).
 * Retorna lista ordenada por score RRF descrescente.
 */
function fuseRRFInCode(
  denseHits: QdrantHit[],
  sparseHits: QdrantHit[],
  k = 60,
  topN = 50,
): QdrantHit[] {
  const scoreById = new Map<string, { score: number; payload: QdrantHit["payload"] }>();
  const lists: Array<QdrantHit[]> = [denseHits, sparseHits];
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const cur = scoreById.get(hit.id);
      const inc = 1 / (k + rank + 1);
      if (cur) {
        cur.score += inc;
      } else {
        scoreById.set(hit.id, { score: inc, payload: hit.payload });
      }
    });
  }
  return Array.from(scoreById.entries())
    .map(([id, v]) => ({ id, score: v.score, payload: v.payload }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Busca híbrida principal — exposta para `retrieveLegalContext`.
 */
export async function searchHybridQdrant(
  args: SearchHybridArgs,
): Promise<SearchHybridResult> {
  const t0 = Date.now();
  if (!args.query.trim()) {
    return {
      results: [],
      trace: {
        hybridNativeUsed: false,
        sparseUnavailable: true,
        denseMs: 0,
        sparseMs: 0,
        fusionMs: 0,
        totalMs: 0,
      },
    };
  }

  const collections = args.collectionsOverride ?? pickCollections(args.filters);
  if (collections.length === 0) {
    return {
      results: [],
      trace: {
        hybridNativeUsed: false,
        sparseUnavailable: true,
        denseMs: 0,
        sparseMs: 0,
        fusionMs: 0,
        totalMs: Date.now() - t0,
      },
    };
  }

  const denseVec = await embedQuery(args.query);
  const sparseVec = buildLegalSparseQuery(
    args.query,
    args.intent
      ? {
          urns: args.intent.urns,
          articleRefs: args.intent.articleRefs,
          tribunals: args.intent.tribunals,
        }
      : undefined,
  );
  const filter = buildHybridFilter(args.filters);

  const client = qdrantClient();
  const perCollectionLimit = Math.ceil(args.limit / collections.length) + 8;

  const allHits: QdrantHit[] = [];
  let hybridNativeUsed = false;
  let sparseUnavailable = false;
  let denseMs = 0;
  let sparseMs = 0;
  let fusionMs = 0;

  for (const collection of collections) {
    // 1. Tentar nativo (server-side fusion)
    const native = await tryNativeHybrid(client, collection, {
      denseVec,
      sparseVec,
      filter,
      limit: perCollectionLimit,
    });

    if (native) {
      hybridNativeUsed = true;
      // No caminho nativo, denseMs absorve TUDO; sparseMs fica 0
      // (server-side, sem visibilidade granular).
      denseMs += native.ms;
      allHits.push(...native.hits);
      continue;
    }

    // 2. Fallback paralelo
    const par = await tryParallelHybrid(client, collection, {
      denseVec,
      sparseVec,
      filter,
      limit: perCollectionLimit,
    });
    denseMs += par.denseMs;
    sparseMs += par.sparseMs;
    if (par.sparseUnavailable) sparseUnavailable = true;

    const tFusion = Date.now();
    const fused = fuseRRFInCode(par.denseHits, par.sparseHits, 60, perCollectionLimit);
    fusionMs += Date.now() - tFusion;
    allHits.push(...fused);
  }

  // Ordena cross-collection.
  allHits.sort((a, b) => b.score - a.score);
  const top = allHits.slice(0, args.limit);
  if (top.length === 0) {
    return {
      results: [],
      trace: {
        hybridNativeUsed,
        sparseUnavailable,
        denseMs,
        sparseMs,
        fusionMs,
        totalMs: Date.now() - t0,
      },
    };
  }

  // Resolve lineage Postgres em uma query única.
  const ids = top.map((h) => h.id);
  const rows = await prisma.legalChunk.findMany({
    where: { vectorPointId: { in: ids } },
    include: {
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
      version: { select: { id: true, validFrom: true, validTo: true } },
    },
  });

  const byPointId = new Map<string, (LegalChunk & { norm: LegalNorm; version: LegalNormVersion })>();
  for (const r of rows) {
    if (r.vectorPointId) byPointId.set(r.vectorPointId, r as never);
  }

  const out: HybridResult[] = [];
  for (const h of top) {
    const r = byPointId.get(h.id);
    if (!r) continue;
    out.push({
      rawScore: h.score,
      source: hybridNativeUsed
        ? "hybrid"
        : sparseUnavailable
          ? "dense_only"
          : "hybrid",
      chunk: {
        chunkId: r.id,
        text: r.text,
        fullPath: r.fullPath,
        structure: r.structure,
        articleRef: r.articleRef,
        contentHash: r.contentHash,
        versionId: r.normVersionId,
        validFrom: r.version.validFrom,
        validTo: r.version.validTo,
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
      },
    });
  }

  return {
    results: out,
    trace: {
      hybridNativeUsed,
      sparseUnavailable,
      denseMs,
      sparseMs,
      fusionMs,
      totalMs: Date.now() - t0,
    },
  };
}

export function hybridToCandidates(results: HybridResult[]): RetrievalCandidate[] {
  return results.map((r, i) => ({
    chunkId: r.chunk.chunkId,
    rank: i,
    rawScore: r.rawScore,
    // Mapeamos "hybrid" para "dense" no enum existente — a provenance fina é
    // observada via `trace.hybridNativeUsed` no relatório de retrieval.
    source: "dense" as const,
  }));
}
