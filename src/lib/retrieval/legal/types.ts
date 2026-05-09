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
  /** F3.5 — Filtra por inciso (chunker v3). */
  incisoRefs?: string[];
  /** F3.5 — Filtra por parágrafo (chunker v3). */
  paragraphRefs?: string[];
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
  /**
   * Gate de QA/local: desabilita qualquer etapa que exija embedding/Qdrant.
   * Mantém pipeline determinístico via BM25 + fusão + scoring + trace.
   *
   * Importante: não usar em produção para o usuário final (degrada recall).
   */
  disableVectorSearch?: boolean;
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
  /**
   * F3 — Contexto do caso para query expansion temática. Quando passado,
   * `rewriteLegalQuery` usa `topic-aliases` para gerar variantes
   * orientadas pela área detectada pelo CaseBrain.
   */
  caseContext?: {
    area: string[];
    problem?: string;
  };
  /**
   * F4 — Fontes pinadas pelo advogado que DEVEM constar no resultado
   * mesmo que o ranking natural não as eleja. Garantia explícita de
   * grounding para a etapa de drafting.
   *
   * - `chunkIds`: chunks específicos a injetar (ordem preservada).
   * - `normUrns`: garante ao menos um chunk de cada norma listada.
   *
   * Implementação: pós-processo que carrega chunks faltantes do banco e
   * os prepende ao topo do resultado final.
   */
  mustInclude?: {
    chunkIds?: string[];
    normUrns?: string[];
  };
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
  /** Boost específico quando artigoRef casa com a query/intent. */
  exactArticleBoost?: number;
  /** Boost por alinhamento com tópico/área (heurístico). */
  topicBoost?: number;
  /** Boost quando há contexto do caso (heurístico). */
  caseContextBoost?: number;
  /** Boost por fonte pinada/mustInclude. */
  pinnedBoost?: number;
  /** Penalidade por chunk longo. */
  longChunkPenalty?: number;
  /** Penalidade por ADCT fora de contexto. */
  adctPenalty?: number;
  /** Penalidade quando fora de vigência (revogado vs asOf). */
  revokedPenalty?: number;
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
  /**
   * F7.2 — Plano explícito da busca (o "porquê" do pipeline).
   * Preenchido pelo orquestrador; útil para auditoria e UI admin/dev.
   */
  searchPlan?: import("./search-plan").LegalSearchPlan;
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
   * Breakdown de latência por estágio (em ms).
   * - `denseMs`: tempo somado das chamadas Qdrant dense (ou hybrid nativo).
   * - `sparseMs`: tempo das chamadas sparse (apenas no fallback in-code).
   * - `ftsMs`: tempo do BM25 Postgres FTS.
   * - `fusionMs`: tempo total das fusões RRF (in-code Qdrant + final).
   * - `cacheHit`: true se o resultado veio de cache (Redis/LRU).
   * - `cacheBackend`: backend que serviu o cache hit (`redis` | `lru` | null).
   */
  timings?: {
    denseMs: number;
    sparseMs: number;
    ftsMs: number;
    fusionMs: number;
  };
  cache?: {
    hit: boolean;
    backend: "redis" | "lru" | null;
  };
  /**
   * Flags de fallback acumuladas durante o pipeline. Vazio quando tudo correu
   * bem; valores possíveis incluem: `dense_unavailable`, `dense_timeout`,
   * `hybrid_unavailable`, `hybrid_timeout`, `hybrid_native_unavailable`,
   * `sparse_unavailable`, `qdrant_unavailable`, `rerank_skipped`,
   * `graph_skipped`, `redis_unavailable`, `cache_unavailable`.
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
