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

const COMMON_INDEXES: Array<{
  field: string;
  schema: "keyword" | "integer" | "text" | "datetime" | "float";
}> = [
  { field: "tenantScope", schema: "keyword" },
  { field: "workspaceId", schema: "keyword" },
  { field: "normUrn", schema: "keyword" },
  { field: "normId", schema: "keyword" },
  { field: "normVersionId", schema: "keyword" },
  { field: "kind", schema: "keyword" },
  { field: "jurisdiction", schema: "keyword" },
  { field: "tribunal", schema: "keyword" },
  { field: "structure", schema: "keyword" },
  { field: "articleRef", schema: "keyword" },
  { field: "publishedAtTs", schema: "integer" },
  { field: "validFromTs", schema: "integer" },
  { field: "contentHash", schema: "keyword" },
  { field: "tags", schema: "keyword" },
  { field: "text", schema: "text" },
];

/**
 * Cria collections idempotentemente e instala payload indexes.
 * Pode ser chamado em scripts e em jobs (é seguro re-executar).
 */
export async function ensureCorpusCollections(client: QdrantClient): Promise<void> {
  for (const collection of Object.values(CORPUS_COLLECTIONS)) {
    const exists = await client.collectionExists(collection);
    if (!exists.exists) {
      await client.createCollection(collection, {
        vectors: { size: CORPUS_VECTOR_SIZE, distance: CORPUS_DISTANCE },
        // hnsw_config defaults são bons para começar; tuning fica para depois
        // (m=16, ef_construct=100). Quantization off por agora — ativável.
      });
    }
    for (const idx of COMMON_INDEXES) {
      try {
        await client.createPayloadIndex(collection, {
          field_name: idx.field,
          field_schema: idx.schema,
        });
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
  /** "__global__" para corpus público. */
  workspaceId: string;
  normUrn: string;
  normId: string;
  normVersionId: string;
  kind: NormKind;
  jurisdiction: string;
  tribunal?: string;
  structure: string;
  articleRef?: string;
  fullPath?: string;
  publishedAtTs?: number;
  validFromTs?: number;
  contentHash: string;
  tags?: string[];
  text: string;
};
