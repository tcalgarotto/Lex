/**
 * `npm run qdrant:reindex-sparse`
 *
 * Re-upserta APENAS os sparse vectors (`keywords`) dos pontos já em
 * `lex_corpus_norms`/`lex_corpus_jurisprudence`, mantendo:
 *   - mesmo `point.id`
 *   - dense vector intocado (não é enviado no upsert)
 *   - payload intocado
 *
 * Utilidade:
 *  - Ajustamos `buildLegalSparseVector` (mais peso pra `tema`, n-gram novo,
 *    etc.) e queremos atualizar o índice esparso sem custo de DeepInfra
 *    nem `scroll+drop+recreate`.
 *  - A migration completa (`qdrant-migrate-hybrid`) seguinte continua
 *    funcionando porque o sparse seria sobrescrito de qualquer jeito.
 *
 * Pré-requisito: collection já no schema híbrido (named dense + sparse).
 *                Se ainda for legacy (vetor único sem nome), rode
 *                `qdrant:migrate-hybrid` primeiro.
 *
 * Idempotente: rodar 2x consecutivos não cria pontos novos nem altera
 * vetor dense. Usa update em batch via `client.upsert` (mesma id).
 */
import "../src/lib/env-normalize";
import { QdrantClient } from "@qdrant/js-client-rest";
import { prisma } from "../src/lib/prisma";
import {
  CORPUS_COLLECTIONS,
  SPARSE_VECTOR_NAME,
} from "../src/lib/corpus/qdrant-collections";
import { buildLegalSparseVector } from "../src/lib/retrieval/legal/sparse";

type Args = { collections: string[]; batchSize: number; limit?: number };

function parseArgs(argv: string[]): Args {
  const out: Args = {
    collections: [CORPUS_COLLECTIONS.norms],
    batchSize: 64,
  };
  for (const a of argv) {
    if (a.startsWith("--collection=")) {
      out.collections = [a.slice("--collection=".length)];
    } else if (a.startsWith("--batch=")) {
      out.batchSize = Number(a.slice("--batch=".length)) || 64;
    } else if (a.startsWith("--limit=")) {
      out.limit = Number(a.slice("--limit=".length));
    }
  }
  return out;
}

function readMeta<T = string>(md: unknown, key: string): T | undefined {
  if (md && typeof md === "object" && md !== null) {
    const v = (md as Record<string, unknown>)[key];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

async function reindexSparseForCollection(
  client: QdrantClient,
  collection: string,
  args: Args,
): Promise<{ scanned: number; upserted: number; errors: number }> {
  // Lê os chunks ativos do Postgres com vectorPointId (ligação reversa para o
  // ponto no Qdrant). Limita o universo aos chunks que sabemos que estão
  // indexados — assim, evitamos upsertar IDs órfãos.
  const findArgs: Parameters<typeof prisma.legalChunk.findMany>[0] = {
    where: { vectorPointId: { not: null } },
    select: {
      id: true,
      vectorPointId: true,
      text: true,
      articleRef: true,
      paragraphRef: true,
      incisoRef: true,
      alineaRef: true,
      metadataJson: true,
    },
  };
  if (args.limit !== undefined) findArgs.take = args.limit;
  const chunks = await prisma.legalChunk.findMany(findArgs);

  let scanned = 0;
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i += args.batchSize) {
    const slice = chunks.slice(i, i + args.batchSize);
    scanned += slice.length;

    const points = slice
      .filter((c) => c.vectorPointId)
      .map((c) => {
        const md = c.metadataJson;
        const sparse = buildLegalSparseVector(c.text, {
          codigo: readMeta<string>(md, "codigo") ?? null,
          tipo: readMeta<string>(md, "tipo") ?? null,
          tema: readMeta<string>(md, "tema") ?? null,
          hierarchy:
            readMeta<string>(md, "hierarchy") ?? readMeta<string>(md, "hierarquia") ?? null,
          articleRef: c.articleRef,
          paragraphRef: c.paragraphRef,
          incisoRef: c.incisoRef,
          alineaRef: c.alineaRef,
        });
        return {
          id: c.vectorPointId!,
          vector: {
            [SPARSE_VECTOR_NAME]: { indices: sparse.indices, values: sparse.values },
          },
        };
      });

    if (points.length === 0) continue;

    try {
      // Upsert apenas com o vetor `keywords` — Qdrant preserva o `dense`
      // existente e os payloads não tocados.
      await client.upsert(collection, { wait: true, points: points as never });
      upserted += points.length;
    } catch (err) {
      errors += points.length;
      console.error(
        `[qdrant.reindex-sparse] batch ${i}-${i + slice.length} falhou: ${(err as Error).message}`,
      );
    }
  }

  return { scanned, upserted, errors };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const args = parseArgs(argv);

  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) {
    console.error("QDRANT_URL não setado.");
    process.exit(1);
  }
  const client = new QdrantClient({ url, apiKey: apiKey || undefined });

  console.log("═══ Qdrant reindex-sparse ═══");
  console.log(`URL: ${url}`);
  console.log(`Collections: ${args.collections.join(", ")}`);
  console.log(`Batch: ${args.batchSize}${args.limit ? `  Limit: ${args.limit}` : ""}`);
  console.log("");

  for (const collection of args.collections) {
    const exists = await client.collectionExists(collection);
    if (!exists.exists) {
      console.log(`◷ ${collection}: não existe — pulando.`);
      continue;
    }
    const t0 = Date.now();
    const r = await reindexSparseForCollection(client, collection, args);
    console.log(
      `◆ ${collection}: scanned=${r.scanned} upserted=${r.upserted} errors=${r.errors} (${Date.now() - t0}ms)`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
