/**
 * Collections Qdrant do corpus jurídico.
 *
 * Separadas pra:
 *  - Permitir tuning de HNSW por tipo (ex.: jurisprudência tem milhões de chunks).
 *  - Garantir filtros eficientes por workspace e tipo.
 *  - Eventualmente migrar collection (re-indexar) sem afetar a outra.
 *
 * Multi-tenancy: payload sempre carrega `workspaceId` (default `__global__`
 * para corpus público) e `tenantScope` (`global` | `workspace`).
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import type { NormKind } from "@prisma/client";

export const CORPUS_COLLECTIONS = {
  /** Legislação (leis, decretos, MP, EC, constituição, códigos). */
  norms: "lex_corpus_norms",
  /** Jurisprudência e súmulas (STF/STJ/TST/outros). */
  jurisprudence: "lex_corpus_jurisprudence",
} as const;

export type CorpusCollection =
  (typeof CORPUS_COLLECTIONS)[keyof typeof CORPUS_COLLECTIONS];

export const CORPUS_VECTOR_SIZE = 1024;
export const CORPUS_DISTANCE = "Cosine" as const;

const JURISPRUDENCE_KINDS = new Set<NormKind>([
  "JURISPRUDENCE_STF",
  "JURISPRUDENCE_STJ",
  "JURISPRUDENCE_TST",
  "JURISPRUDENCE_OTHER",
  "SUMULA_STF",
  "SUMULA_STJ",
  "SUMULA_VINCULANTE",
  "REPETITIVE_THEME",
] as const);

export function collectionForKind(kind: NormKind): CorpusCollection {
  return JURISPRUDENCE_KINDS.has(kind)
    ? CORPUS_COLLECTIONS.jurisprudence
    : CORPUS_COLLECTIONS.norms;
}

/**
 * Configuração de payload index. `tenant=true` marca o índice como
 * "tenant index" (Qdrant ≥ 1.10) — otimização crítica para workspaces:
 * Qdrant agrupa pontos do mesmo tenant em segmentos contíguos e reduz
 * drasticamente a latência de filtragem.
 */
type PayloadIndexSpec = {
  field: string;
  schema: "keyword" | "integer" | "text" | "datetime" | "float";
  tenant?: boolean;
};

const COMMON_INDEXES: PayloadIndexSpec[] = [
  // Multi-tenant — workspaceId é o eixo crítico (corpus oficial = "_global_",
  // overrides de workspace = workspaceId real).
  { field: "workspaceId", schema: "keyword", tenant: true },
  { field: "tenantScope", schema: "keyword" },
  // Camada do payload (legal_corpus | workspace_document | …).
  { field: "layer", schema: "keyword" },
  // Lineage normativa.
  { field: "normUrn", schema: "keyword" },
  { field: "normId", schema: "keyword" },
  { field: "normVersionId", schema: "keyword" },
  { field: "kind", schema: "keyword" },
  { field: "jurisdiction", schema: "keyword" },
  { field: "tribunal", schema: "keyword" },
  // Estrutura interna do chunk.
  { field: "structure", schema: "keyword" },
  { field: "articleRef", schema: "keyword" },
  { field: "paragraphRef", schema: "keyword" },
  { field: "incisoRef", schema: "keyword" },
  { field: "alineaRef", schema: "keyword" },
  // Filtros temporais.
  { field: "publishedAtTs", schema: "integer" },
  { field: "validFromTs", schema: "integer" },
  // Integridade / dedup.
  { field: "contentHash", schema: "keyword" },
  { field: "tags", schema: "keyword" },
  // Campos do corpus canônico semântico (briefing FASE 5).
  { field: "codigo", schema: "keyword" },
  { field: "tipo", schema: "keyword" },
  { field: "tema", schema: "keyword" },
  { field: "sourceProvider", schema: "keyword" },
  { field: "status", schema: "keyword" },
  // Texto livre (preview leve com tokenizer word + lowercase).
  { field: "textPreview", schema: "text" },
];

/** Nome do vetor denso (named vector) — usado no Qdrant Query API. */
export const DENSE_VECTOR_NAME = "dense";

/** Nome do sparse vector — usado em prefetch híbrido. */
export const SPARSE_VECTOR_NAME = "keywords";

/**
 * Cria collections idempotentemente, com named dense + sparse vectors,
 * e instala payload indexes (incluindo tenant index para `workspaceId`).
 *
 * Idempotente: se a collection já existe, **não** dropa nem altera o schema —
 * apenas garante os indexes. Para migrar uma collection legada (vetor único
 * sem nome) para o novo schema, use `scripts/qdrant-migrate-hybrid.ts`.
 */
export async function ensureCorpusCollections(client: QdrantClient): Promise<void> {
  for (const collection of Object.values(CORPUS_COLLECTIONS)) {
    const exists = await client.collectionExists(collection);
    if (!exists.exists) {
      await client.createCollection(collection, {
        // Named dense vector — necessário para hybrid search via Query API.
        vectors: {
          [DENSE_VECTOR_NAME]: { size: CORPUS_VECTOR_SIZE, distance: CORPUS_DISTANCE },
        },
        // Sparse vector "keywords" — recebe vetores BM25-like jurídicos.
        sparse_vectors: {
          [SPARSE_VECTOR_NAME]: {},
        },
        // hnsw_config defaults são bons para começar; tuning fica para depois
        // (m=16, ef_construct=100). Quantization off por agora — ativável.
      });
    }
    for (const idx of COMMON_INDEXES) {
      try {
        const params: Record<string, unknown> = {
          field_name: idx.field,
          field_schema: idx.schema,
        };
        // Tenant index — Qdrant cluster pontos do mesmo workspaceId em
        // segmentos contíguos para acelerar filtros multi-tenant.
        if (idx.tenant) {
          params["field_schema"] = {
            type: "keyword",
            is_tenant: true,
          };
        }
        await client.createPayloadIndex(
          collection,
          params as Parameters<typeof client.createPayloadIndex>[1],
        );
      } catch (err) {
        // Idempotente: se já existe, Qdrant retorna erro mas seguimos.
        const msg = (err as Error)?.message ?? String(err);
        if (!/already exists/i.test(msg)) {
          throw err;
        }
      }
    }
  }
}

/** Payload canônico de chunk no Qdrant. */
export type CorpusVectorPayload = {
  /** "global" para corpus público, "workspace" para overrides por tenant. */
  tenantScope: "global" | "workspace";
  /**
   * Tenant id. Para `lex_corpus_norms`/`lex_corpus_jurisprudence`:
   * `"_global_"` (corpus oficial) ou um workspaceId real (overrides).
   * Para `lex_main`: `"__global__"` ou workspaceId real (uploads de usuário).
   */
  workspaceId: string;
  /**
   * Camada do payload — discrimina corpus oficial de uploads de usuário
   * para evitar que filtros tenant cruzem layers diferentes.
   * Valores: `"legal_corpus"` (legislação/jurisprudência oficiais),
   * `"workspace_document"` (uploads).
   */
  layer: string;
  normUrn: string;
  normId: string;
  normVersionId: string;
  kind: NormKind;
  jurisdiction: string;
  tribunal?: string;
  structure: string;
  articleRef?: string;
  paragraphRef?: string;
  incisoRef?: string;
  alineaRef?: string;
  fullPath?: string;
  publishedAtTs?: number;
  validFromTs?: number;
  /** ISO 8601 (data) — duplica `validFromTs` para queries amigáveis. */
  validFromIso?: string;
  /** ISO 8601 (data) — null/undefined = vigente. */
  validToIso?: string;
  contentHash: string;
  tags?: string[];
  /** Texto completo do chunk — preservado para reranker e display. */
  text: string;
  /**
   * Preview leve do texto (≤ 320 chars) — indexado como text para boost
   * em buscas exatas que escapem do BM25/sparse.
   */
  textPreview?: string;
  /** Estimativa de tokens (heurística: chars/4) — útil para budget de prompt. */
  tokensEstimate?: number;
  /**
   * Marca chunks oriundos de `[DOCUMENT_NOTE]` (assinaturas, cabeçalhos de
   * publicação) que NÃO devem ser tratados como norma vinculante.
   */
  isDocumentNote?: boolean;
  // ── Campos do corpus canônico semântico (briefing FASE 5) ──
  /** Ex.: "CF" ou "ADCT". Vem de `LegalChunk.metadataJson.codigo`. */
  codigo?: string;
  /** Ex.: "CONSTITUICAO". */
  tipo?: string;
  /** Slug, ex.: "direitos_garantias_fundamentais". */
  tema?: string;
  /** Hierarquia legível ("Título II > Direitos ...> Capítulo I"). */
  hierarchy?: string;
  /** Tag do provedor (ex.: "MANUAL_MD"). */
  sourceProvider?: string;
  /** Caminho do arquivo fonte. */
  sourcePath?: string;
  /** Status da norma ("ACTIVE", "REVOKED", ...). */
  status?: string;
  /** Título humano da norma (snapshot pra UI/retrieval). */
  normTitle?: string;
  /** Identificador humano (ex.: "CF/1988"). */
  identifier?: string;
  /** "MAIN" | "ADCT" — segmento dentro da CF. */
  segment?: string;
};
