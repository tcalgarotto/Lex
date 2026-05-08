/**
 * `npm run corpus:reset`  /  `npm run corpus:reset -- --execute`
 *
 * Reset COMPLETO do corpus jurídico vetorial:
 *  1. (DB) DELETE em LegalChunk → LegalCitation → LegalNormVersion → LegalNorm
 *     → IngestionJob → IngestionWatermark.
 *  2. (Qdrant) DROP + recreate de `lex_corpus_norms` e
 *     `lex_corpus_jurisprudence` (com payload indexes completos).
 *
 * NÃO toca em:
 *  - Tabelas de auth/billing/onboarding.
 *  - Document, DocumentChunk, LegalPiece, Process, Workspace, User.
 *  - Collection Qdrant `lex_main` (uploads do usuário).
 *
 * Por segurança, exige `--execute` para aplicar. Sem flag, faz um dry-run
 * imprimindo o impacto previsto.
 *
 * Uso:
 *   npm run corpus:reset                       # dry-run
 *   npm run corpus:reset -- --execute          # aplica de verdade
 *   npm run corpus:reset -- --execute --skip-qdrant
 *   npm run corpus:reset -- --execute --skip-db
 */

import "../src/lib/env-normalize";
import { QdrantClient } from "@qdrant/js-client-rest";
import { prisma } from "../src/lib/prisma";
import {
  CORPUS_COLLECTIONS,
  ensureCorpusCollections,
} from "../src/lib/corpus/qdrant-collections";

type Flags = {
  execute: boolean;
  skipDb: boolean;
  skipQdrant: boolean;
};

function parseFlags(argv: string[]): Flags {
  return {
    execute: argv.includes("--execute"),
    skipDb: argv.includes("--skip-db"),
    skipQdrant: argv.includes("--skip-qdrant"),
  };
}

async function readDbCounts(): Promise<{
  chunks: number;
  citations: number;
  versions: number;
  norms: number;
  jobs: number;
  watermarks: number;
}> {
  const [chunks, citations, versions, norms, jobs, watermarks] = await Promise.all([
    prisma.legalChunk.count(),
    prisma.legalCitation.count(),
    prisma.legalNormVersion.count(),
    prisma.legalNorm.count(),
    prisma.ingestionJob.count(),
    prisma.ingestionWatermark.count(),
  ]);
  return { chunks, citations, versions, norms, jobs, watermarks };
}

async function resetDb(): Promise<void> {
  // Ordem importa (FK constraints): chunks/citations primeiro, depois versions,
  // depois norms. Jobs/watermarks são independentes.
  console.log("DB › DELETE legal_chunk + legal_citation...");
  await prisma.$transaction([
    prisma.legalChunk.deleteMany({}),
    prisma.legalCitation.deleteMany({}),
  ]);
  console.log("DB › DELETE legal_norm_version...");
  await prisma.legalNormVersion.deleteMany({});
  console.log("DB › DELETE legal_norm...");
  await prisma.legalNorm.deleteMany({});
  console.log("DB › DELETE ingestion_job + ingestion_watermark...");
  await prisma.$transaction([
    prisma.ingestionJob.deleteMany({}),
    prisma.ingestionWatermark.deleteMany({}),
  ]);
}

async function readQdrantPoints(client: QdrantClient): Promise<Record<string, number | "missing" | "error">> {
  const out: Record<string, number | "missing" | "error"> = {};
  for (const name of Object.values(CORPUS_COLLECTIONS)) {
    try {
      const ex = await client.collectionExists(name);
      if (!ex.exists) {
        out[name] = "missing";
        continue;
      }
      const info = await client.getCollection(name);
      out[name] = info.points_count ?? 0;
    } catch (err) {
      out[name] = "error";
      console.warn(`Qdrant ${name} read error: ${(err as Error).message}`);
    }
  }
  return out;
}

async function resetQdrant(client: QdrantClient): Promise<void> {
  for (const name of Object.values(CORPUS_COLLECTIONS)) {
    const ex = await client.collectionExists(name);
    if (ex.exists) {
      console.log(`Qdrant › DROP ${name}`);
      await client.deleteCollection(name);
    } else {
      console.log(`Qdrant › ${name} já ausente, skip drop`);
    }
  }
  console.log("Qdrant › ensureCorpusCollections (recria + payload indexes)");
  await ensureCorpusCollections(client);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  console.log("═══ CORPUS RESET ═══");
  console.log(`  modo: ${flags.execute ? "EXECUTE" : "dry-run"}`);
  console.log(`  pular DB: ${flags.skipDb}`);
  console.log(`  pular Qdrant: ${flags.skipQdrant}`);
  console.log("");

  const dbBefore = await readDbCounts();
  console.log("[Antes — DB]");
  console.table(dbBefore);

  let qBefore: Record<string, number | "missing" | "error"> | null = null;
  let qclient: QdrantClient | null = null;
  if (!flags.skipQdrant) {
    const url = process.env["QDRANT_URL"];
    const apiKey = process.env["QDRANT_API_KEY"];
    if (!url) {
      console.error("QDRANT_URL ausente — abortando.");
      process.exit(1);
    }
    qclient = new QdrantClient({ url, apiKey: apiKey || undefined });
    qBefore = await readQdrantPoints(qclient);
    console.log("[Antes — Qdrant]");
    console.table(qBefore);
  }

  if (!flags.execute) {
    console.log("");
    console.log("→ Dry-run. Nada foi alterado. Rode novamente com --execute.");
    process.exit(0);
  }

  console.log("");
  console.log(">>> EXECUTANDO RESET <<<");
  console.log("");

  if (!flags.skipDb) {
    await resetDb();
  }

  if (!flags.skipQdrant && qclient) {
    await resetQdrant(qclient);
  }

  console.log("");
  const dbAfter = await readDbCounts();
  console.log("[Depois — DB]");
  console.table(dbAfter);

  if (qclient) {
    const qAfter = await readQdrantPoints(qclient);
    console.log("[Depois — Qdrant]");
    console.table(qAfter);
  }

  console.log("");
  console.log("✔ Reset concluído. Próximo passo: `npm run corpus:seed:official-laws`.");
}

main()
  .catch((err) => {
    console.error("corpus:reset fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
