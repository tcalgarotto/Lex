/**
 * Dense retrieval contra as collections do corpus jurídico.
 *
 *  - Busca em ambas (`lex_corpus_norms` + `lex_corpus_jurisprudence`) e
 *    combina, salvo se o intent indicar fortemente uma só.
 *  - Constrói filtros Qdrant nativos a partir de `LegalRetrievalFilters`.
 *  - Resolve lineage via Postgres em UMA query (evita N+1).
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { type LegalChunk, type LegalNorm, type LegalNormVersion } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { embedQuery } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/prisma";
import {
  collectionForKind,
  CORPUS_COLLECTIONS,
  type CorpusCollection,
} from "@/lib/corpus/qdrant-collections";
import type {
  ChunkWithLineage,
  LegalRetrievalFilters,
  RetrievalCandidate,
} from "./types";

export type DenseResult = {
  chunk: ChunkWithLineage;
  rawScore: number;
};

function qdrantClient(): QdrantClient {
  const env = getEnv();
  return new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY || undefined });
}

/** Decide quais collections consultar dado intent/filters. */
export function pickCollections(filters?: LegalRetrievalFilters): CorpusCollection[] {
  const kinds = filters?.kinds ?? [];
  if (kinds.length === 0) return Object.values(CORPUS_COLLECTIONS);
  const set = new Set<CorpusCollection>();
  for (const k of kinds) set.add(collectionForKind(k));
  return Array.from(set);
}

function buildQdrantFilter(filters: LegalRetrievalFilters | undefined): Record<string, unknown> | undefined {
  if (!filters) return undefined;
  const must: Record<string, unknown>[] = [];

  if (filters.kinds?.length) {
    must.push({ key: "kind", match: { any: filters.kinds.map(String) } });
  }
  if (filters.jurisdictions?.length) {
    must.push({ key: "jurisdiction", match: { any: filters.jurisdictions.map(String) } });
  }
  if (filters.tribunals?.length) {
    must.push({ key: "tribunal", match: { any: filters.tribunals } });
  }
  if (filters.articleRefs?.length) {
    must.push({ key: "articleRef", match: { any: filters.articleRefs } });
  }
  if (filters.normUrns?.length) {
    must.push({ key: "normUrn", match: { any: filters.normUrns } });
  }
  if (filters.publishedAfter) {
    const ts = Math.floor(filters.publishedAfter.getTime() / 1000);
    must.push({ key: "publishedAtTs", range: { gte: ts } });
  }
  if (filters.asOf) {
    const ts = Math.floor(filters.asOf.getTime() / 1000);
    // Em Qdrant filtramos validFromTs <= asOf; validTo é tratado em PG (nem
    // todo chunk no Qdrant carrega validToTs). Esse filtro é só pra reduzir
    // candidatos antigos demais.
    must.push({ key: "validFromTs", range: { lte: ts } });
  }
  return must.length > 0 ? { must } : undefined;
}

/**
 * Busca dense nas collections corpus, retornando candidatos com lineage.
 */
export async function searchDense(args: {
  query: string;
  limit: number;
  filters?: LegalRetrievalFilters;
  collectionsOverride?: CorpusCollection[];
}): Promise<DenseResult[]> {
  if (!args.query.trim()) return [];

  const collections = args.collectionsOverride ?? pickCollections(args.filters);
  if (collections.length === 0) return [];

  const vector = await embedQuery(args.query);
  const filter = buildQdrantFilter(args.filters);

  const client = qdrantClient();
  const perCollectionLimit = Math.ceil(args.limit / collections.length) + 8;

  type QdrantHit = { id: string; score: number; payload: Record<string, unknown> | undefined };
  const hits: QdrantHit[] = [];

  for (const collection of collections) {
    const res = await client.search(collection, {
      vector,
      limit: perCollectionLimit,
      filter: filter as never,
      with_payload: true,
    });
    for (const r of res) {
      hits.push({
        id: String(r.id),
        score: typeof r.score === "number" ? r.score : 0,
        payload: r.payload as Record<string, unknown> | undefined,
      });
    }
  }

  // Ordena cross-collection e pega os top-N.
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, args.limit);
  if (top.length === 0) return [];

  const chunkIds = top
    .map((h) => h.payload?.["normUrn"]) // sanity check
    .filter(Boolean);
  if (chunkIds.length === 0) return [];

  // Resolve lineage com 1 query (UNION via WHERE id IN ...).
  const vectorIds = top.map((h) => h.id);
  const rows = await prisma.legalChunk.findMany({
    where: { vectorPointId: { in: vectorIds } },
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
  for (const r of rows) byPointId.set(r.vectorPointId!, r as never);

  const out: DenseResult[] = [];
  for (const h of top) {
    const r = byPointId.get(h.id);
    if (!r) continue;
    out.push({
      rawScore: h.score,
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

  return out;
}

export function denseToCandidates(results: DenseResult[]): RetrievalCandidate[] {
  return results.map((r, i) => ({
    chunkId: r.chunk.chunkId,
    rank: i,
    rawScore: r.rawScore,
    source: "dense" as const,
  }));
}
