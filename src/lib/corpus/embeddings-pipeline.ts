/**
 * Pipeline de embeddings + upsert no Qdrant para chunks do corpus jurídico.
 *
 *  - Batch (default 16) — minimiza chamadas ao provider.
 *  - Retry com exponential backoff em falhas transientes (5xx/timeout).
 *  - Cache via embedTexts (já implementa Redis).
 *  - Observabilidade: emite logs por batch e contadores agregados.
 *  - Marca `vectorPointId` no `LegalChunk` após upsert.
 *
 * Nota: collections Qdrant são escolhidas via `collectionForKind` baseado no
 * `NormKind` da norma — chunks de jurisprudência vão para a collection certa.
 */

import { randomUUID } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { LegalNorm, LegalNormVersion, LegalChunk } from "@prisma/client";
import { embedTexts } from "@/lib/ai/embeddings";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { CORPUS_LAYER_LEGAL, LEGAL_CORPUS_TENANT_ID } from "@/lib/constants";
import {
  buildLegalSparseVector,
  type SparseVector,
} from "@/lib/retrieval/legal/sparse";
import {
  collectionForKind,
  DENSE_VECTOR_NAME,
  SPARSE_VECTOR_NAME,
  type CorpusVectorPayload,
} from "./qdrant-collections";

/**
 * Tenant id padrão para corpus jurídico oficial.
 * @deprecated Use {@link LEGAL_CORPUS_TENANT_ID} de `@/lib/constants`.
 *             Mantido como alias durante a migration de `__global__` →
 *             `_global_`.
 */
export const GLOBAL_TENANT_WORKSPACE = LEGAL_CORPUS_TENANT_ID;

export type EmbedAndUpsertResult = {
  chunksProcessed: number;
  chunksSkipped: number;
  errors: number;
  durationMs: number;
};

function qdrantClient(): QdrantClient {
  const env = getEnv();
  return new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY || undefined });
}

function epoch(d?: Date | null): number | undefined {
  return d ? Math.floor(d.getTime() / 1000) : undefined;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 4,
  baseDelayMs = 500,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = (err as Error)?.message ?? String(err);
      const transient =
        /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed|429|5\d{2}/i.test(msg);
      if (!transient || i === attempts - 1) throw err;
      const wait = baseDelayMs * 2 ** i + Math.random() * 200;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last ?? new Error("withRetry: falhou sem erro associado");
}

type ChunkWithLineage = LegalChunk & {
  norm: Pick<
    LegalNorm,
    "id" | "urn" | "kind" | "jurisdiction" | "tribunal" | "publishedAt" | "tags" | "title" | "identifier" | "status"
  >;
  version: Pick<LegalNormVersion, "id" | "validFrom">;
};

function readMetaString(
  metadata: unknown,
  key: string,
): string | undefined {
  if (metadata && typeof metadata === "object" && metadata !== null) {
    const v = (metadata as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

/**
 * Embeda + upserta chunks de UMA versão de norma. Idempotente: chunks que
 * já têm `vectorPointId` são pulados (já indexados).
 */
export async function embedAndUpsertNormVersion(args: {
  normVersionId: string;
  batchSize?: number;
  client?: QdrantClient;
}): Promise<EmbedAndUpsertResult> {
  const start = Date.now();
  const batchSize = args.batchSize ?? 16;
  const client = args.client ?? qdrantClient();

  const chunks = (await prisma.legalChunk.findMany({
    where: { normVersionId: args.normVersionId, vectorPointId: null },
    orderBy: { ordinal: "asc" },
    include: {
      norm: {
        select: {
          id: true,
          urn: true,
          kind: true,
          jurisdiction: true,
          tribunal: true,
          publishedAt: true,
          tags: true,
          title: true,
          identifier: true,
          status: true,
        },
      },
      version: { select: { id: true, validFrom: true } },
    },
  })) as ChunkWithLineage[];

  if (chunks.length === 0) {
    return { chunksProcessed: 0, chunksSkipped: 0, errors: 0, durationMs: Date.now() - start };
  }

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);
    const texts = slice.map((c) => c.text);

    let vectors: number[][];
    try {
      vectors = await withRetry(() => embedTexts(texts));
    } catch (err) {
      errors += slice.length;
      console.error(
        `[corpus.embeddings] batch ${i} falhou após retries: ${(err as Error).message}`,
      );
      continue;
    }

    const byCollection = new Map<
      string,
      Array<{
        id: string;
        dense: number[];
        sparse: SparseVector;
        payload: CorpusVectorPayload;
        chunkId: string;
      }>
    >();

    for (let j = 0; j < slice.length; j++) {
      const c = slice[j]!;
      const vec = vectors[j];
      if (!vec) continue;
      const collection = collectionForKind(c.norm.kind);
      // Hidrata campos do briefing FASE 5 a partir de chunk.metadataJson
      // (preenchido pela ingest-constitution function ou outro pipeline).
      const md = c.metadataJson;
      const codigo = readMetaString(md, "codigo");
      const tipo = readMetaString(md, "tipo");
      const tema = readMetaString(md, "tema");
      const hierarchy = readMetaString(md, "hierarchy") ?? readMetaString(md, "hierarquia");
      const sourceProvider = readMetaString(md, "sourceProvider");
      const sourcePath = readMetaString(md, "sourcePath");
      const segment = readMetaString(md, "segment");

      const sparse = buildLegalSparseVector(c.text, {
        ...(codigo ? { codigo } : {}),
        ...(tipo ? { tipo } : {}),
        ...(tema ? { tema } : {}),
        ...(hierarchy ? { hierarchy } : {}),
        ...(c.articleRef ? { articleRef: c.articleRef } : {}),
        ...(c.paragraphRef ? { paragraphRef: c.paragraphRef } : {}),
        ...(c.incisoRef ? { incisoRef: c.incisoRef } : {}),
        ...(c.alineaRef ? { alineaRef: c.alineaRef } : {}),
      });

      const textPreview = c.text.length > 320 ? `${c.text.slice(0, 317)}...` : c.text;
      const tokensEstimate = Math.ceil(c.text.length / 4);

      const point = {
        id: randomUUID(),
        chunkId: c.id,
        dense: vec,
        sparse,
        payload: {
          tenantScope: "global" as const,
          workspaceId: LEGAL_CORPUS_TENANT_ID,
          layer: CORPUS_LAYER_LEGAL,
          normUrn: c.norm.urn,
          normId: c.norm.id,
          normVersionId: c.version.id,
          kind: c.norm.kind,
          jurisdiction: c.norm.jurisdiction,
          ...(c.norm.tribunal ? { tribunal: c.norm.tribunal } : {}),
          structure: c.structure,
          ...(c.articleRef ? { articleRef: c.articleRef } : {}),
          ...(c.paragraphRef ? { paragraphRef: c.paragraphRef } : {}),
          ...(c.incisoRef ? { incisoRef: c.incisoRef } : {}),
          ...(c.alineaRef ? { alineaRef: c.alineaRef } : {}),
          ...(c.fullPath ? { fullPath: c.fullPath } : {}),
          ...(epoch(c.norm.publishedAt) !== undefined
            ? { publishedAtTs: epoch(c.norm.publishedAt)! }
            : {}),
          ...(epoch(c.version.validFrom) !== undefined
            ? { validFromTs: epoch(c.version.validFrom)! }
            : {}),
          ...(c.version.validFrom
            ? { validFromIso: c.version.validFrom.toISOString().slice(0, 10) }
            : {}),
          contentHash: c.contentHash,
          tags: c.norm.tags,
          text: c.text,
          textPreview,
          tokensEstimate,
          ...(codigo ? { codigo } : {}),
          ...(tipo ? { tipo } : {}),
          ...(tema ? { tema } : {}),
          ...(hierarchy ? { hierarchy } : {}),
          ...(sourceProvider ? { sourceProvider } : {}),
          ...(sourcePath ? { sourcePath } : {}),
          ...(segment ? { segment } : {}),
          status: c.norm.status,
          normTitle: c.norm.title,
          ...(c.norm.identifier ? { identifier: c.norm.identifier } : {}),
        } satisfies CorpusVectorPayload,
      };
      const arr = byCollection.get(collection) ?? [];
      arr.push(point);
      byCollection.set(collection, arr);
    }

    for (const [collection, points] of byCollection) {
      try {
        await withRetry(() =>
          client.upsert(collection, {
            wait: true,
            points: points.map((p) => ({
              id: p.id,
              vector: {
                [DENSE_VECTOR_NAME]: p.dense,
                [SPARSE_VECTOR_NAME]: { indices: p.sparse.indices, values: p.sparse.values },
              },
              payload: p.payload as unknown as Record<string, unknown>,
            })),
          }),
        );
        await prisma.$transaction(
          points.map((p) =>
            prisma.legalChunk.update({
              where: { id: p.chunkId },
              data: { vectorPointId: p.id },
            }),
          ),
        );
        processed += points.length;
      } catch (err) {
        errors += points.length;
        console.error(
          `[corpus.embeddings] upsert ${collection} falhou: ${(err as Error).message}`,
        );
      }
    }
  }

  return {
    chunksProcessed: processed,
    chunksSkipped: chunks.length - processed - errors,
    errors,
    durationMs: Date.now() - start,
  };
}
