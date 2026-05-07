/**
 * Tipos canônicos do retrieval jurídico enterprise.
 *
 * Diferenças vs `RetrievedChunk` legacy (documentos do usuário):
 *  - sempre carrega lineage da norma (URN, versão, hierarquia).
 *  - sempre carrega scores discriminados (dense, bm25, rerank, boost).
 *  - traz `explanation` legível para debugging/grounding.
 */

import type {
  LegalCitation,
  LegalNorm,
  LegalNormVersion,
  LegalStructure,
  NormJurisdiction,
  NormKind,
} from "@prisma/client";

/** Filtros de retrieval. Tudo opcional — orquestrador deriva de intent. */
export type LegalRetrievalFilters = {
  kinds?: NormKind[];
  jurisdictions?: NormJurisdiction[];
  tribunals?: string[];
  /** "Vigente em DD/MM/YYYY" -> filtra por validFrom <= asOf < validTo. */
  asOf?: Date;
  /** Filter por publicação >= dada data. */
  publishedAfter?: Date;
  /** URNs específicas pra restringir o universo de busca. */
  normUrns?: string[];
  /** Referências canônicas a artigo (ex.: ["Art. 5º"]). */
  articleRefs?: string[];
};

export type LegalRetrievalOptions = {
  /** Quantidade final de chunks após pipeline completo. */
  topK?: number;
  /** Quantos chunks alimentamos no rerank (default 32). */
  rerankPool?: number;
  /** Ativa expansão por 1-hop no grafo de citações. Default true. */
  useGraphExpansion?: boolean;
  /** Ativa cross-encoder rerank (BGE-v2-m3). Default true. */
  useRerank?: boolean;
  /** Lê/escreve cache Redis. Default true em prod, false em test. */
  useCache?: boolean;
  /** TTL do cache em segundos. */
  cacheTtlSec?: number;
  /** Tradução automática + sinônimos. Default true. */
  useQueryRewrite?: boolean;
  /** Filtros explícitos (sobrescrevem o que o intent extrair). */
  filters?: LegalRetrievalFilters;
  /** Identifica o request nos logs/traces. */
  traceId?: string;
  /** Inclui chunks marcados como GENERIC/PREAMBULO. Default false. */
  includeGeneric?: boolean;
  /**
   * Workspace que originou a query (apenas para log de observabilidade —
   * o retrieval em si é global, não filtra por workspace).
   */
  workspaceId?: string;
};

/** Componentes do score que somam até o ranking final. */
export type ScoreBreakdown = {
  /** Score do dense retrieval (similaridade de cosseno via Qdrant). */
  dense?: number;
  /** Score BM25 normalizado (ts_rank_cd / max). */
  bm25?: number;
  /** Score do rerank cross-encoder (BGE-reranker-v2-m3). */
  rerank?: number;
  /** Score do RRF (reciprocal rank fusion). */
  rrf?: number;
  /** Boost por alinhamento com intent/filtros (kind, tribunal, asOf). */
  boost?: number;
  /** Score final consolidado 0..1. Sempre presente. */
  final: number;
};

/** Chunk retornado com explainability completa. */
export type LegalRetrievedChunk = {
  /** id estável do `LegalChunk` (uuid). */
  chunkId: string;
  text: string;
  /** Caminho hierárquico humano: "Art. 5º, § 2º". */
  fullPath: string | null;
  structure: LegalStructure;
  articleRef: string | null;
  /** Lineage completa pra rastrear até a norma e versão exata. */
  norm: {
    id: string;
    urn: string;
    kind: NormKind;
    jurisdiction: NormJurisdiction;
    title: string;
    identifier: string | null;
    tribunal: string | null;
    publishedAt: Date | null;
  };
  versionId: string;
  validFrom: Date;
  validTo: Date | null;
  scores: ScoreBreakdown;
  /** "via:dense" | "via:bm25" | "via:hybrid" | "via:graph". */
  provenance: RetrievalProvenance[];
  /** Explicação legível pra debugging. */
  explanation: string;
};

export type RetrievalProvenance =
  | "dense"
  | "bm25"
  | "graph_citation_in"
  | "graph_citation_out"
  | "rerank";

/** Saída completa com trace, grounding e confidence. */
export type LegalRetrievalResult = {
  query: string;
  rewrittenQueries: string[];
  filters: LegalRetrievalFilters;
  intent: import("./intent").LegalIntent;
  chunks: LegalRetrievedChunk[];
  groundingScore: number;
  confidence: { label: "Alta" | "Média" | "Baixa"; score: number; reason: string };
  trace: LegalRetrievalTrace;
  cached: boolean;
};

/** Trace detalhado pra observabilidade e debugging. */
export type LegalRetrievalTrace = {
  traceId: string;
  totalLatencyMs: number;
  stages: Array<{
    stage: string;
    latencyMs: number;
    detail?: Record<string, unknown>;
  }>;
  candidates: {
    dense: number;
    bm25: number;
    afterFusion: number;
    afterGraph: number;
    afterRerank: number;
    final: number;
  };
  /**
   * Flags de fallback acumuladas durante o pipeline. Vazio quando tudo correu
   * bem; valores possíveis incluem: `dense_unavailable`, `dense_timeout`,
   * `qdrant_unavailable`, `rerank_skipped`, `graph_skipped`,
   * `redis_unavailable`, `cache_unavailable`. Útil para auditoria + UI.
   */
  fallbackFlags?: string[];
};

/** Item interno usado na fusão (antes de virar `LegalRetrievedChunk`). */
export type RetrievalCandidate = {
  chunkId: string;
  rank: number;
  /** Score bruto da fonte (dense ou bm25). */
  rawScore: number;
  source: RetrievalProvenance;
};

/** Carga das relações usada nas etapas internas (mantém Prisma rica). */
export type ChunkWithLineage = {
  chunkId: string;
  text: string;
  fullPath: string | null;
  structure: LegalStructure;
  articleRef: string | null;
  contentHash: string;
  versionId: string;
  validFrom: Date;
  validTo: Date | null;
  norm: Pick<
    LegalNorm,
    "id" | "urn" | "kind" | "jurisdiction" | "title" | "identifier" | "tribunal" | "publishedAt"
  >;
};

/** Helpers de tipo (não export pra consumo externo). */
export type _internalCitationView = Pick<
  LegalCitation,
  "id" | "sourceNormId" | "targetNormId" | "kind"
>;

export type _internalVersionView = Pick<LegalNormVersion, "id" | "validFrom" | "validTo">;
