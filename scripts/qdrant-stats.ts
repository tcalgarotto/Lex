/**
 * `npm run qdrant:stats`
 *
 * Snapshot rápido das três collections Qdrant:
 *  - `lex_main` (legacy / documentos de usuário)
 *  - `lex_corpus_norms`
 *  - `lex_corpus_jurisprudence`
 *
 * Exit 0 sempre — diagnóstico puro.
 */

import "../src/lib/env-normalize";
import { QdrantClient } from "@qdrant/js-client-rest";
import { CORPUS_COLLECTIONS } from "../src/lib/corpus/qdrant-collections";

const COLLECTIONS = [
  process.env["QDRANT_COLLECTION"] ?? "lex_main",
  CORPUS_COLLECTIONS.norms,
  CORPUS_COLLECTIONS.jurisprudence,
];

type Snapshot = {
  collection: string;
  exists: boolean;
  pointsCount?: number;
  vectorsCount?: number;
  status?: string;
  error?: string;
};

async function describe(client: QdrantClient, name: string): Promise<Snapshot> {
  try {
    const exists = await client.collectionExists(name);
    if (!exists.exists) {
      return { collection: name, exists: false };
    }
    const info = await client.getCollection(name);
    const indexed =
      "indexed_vectors_count" in info
        ? (info as { indexed_vectors_count?: number | null }).indexed_vectors_count
        : undefined;
    return {
      collection: name,
      exists: true,
      pointsCount: info.points_count ?? undefined,
      vectorsCount: indexed ?? undefined,
      status: info.status,
    };
  } catch (err) {
    return { collection: name, exists: false, error: (err as Error).message };
  }
}

async function main(): Promise<void> {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) {
    console.error("QDRANT_URL não setado.");
    process.exit(1);
  }

  const client = new QdrantClient({ url, apiKey: apiKey || undefined });

  console.log("═══ QDRANT STATS ═══");
  console.log(`URL: ${url}`);
  console.log("");

  const snaps: Snapshot[] = [];
  for (const name of COLLECTIONS) {
    snaps.push(await describe(client, name));
  }

  for (const s of snaps) {
    if (!s.exists) {
      console.log(`✗ ${s.collection.padEnd(28)} (não existe${s.error ? `: ${s.error}` : ""})`);
      continue;
    }
    console.log(
      `✔ ${s.collection.padEnd(28)} points=${(s.pointsCount ?? 0).toString().padStart(8)}  vectors=${(s.vectorsCount ?? 0).toString().padStart(8)}  status=${s.status ?? "?"}`,
    );
  }

  console.log("");
  const norms = snaps.find((s) => s.collection === CORPUS_COLLECTIONS.norms);
  if (norms?.exists && (norms.pointsCount ?? 0) === 0) {
    console.log(
      "⚠ lex_corpus_norms está vazio. Rode `npm run corpus:seed:minimal-legal` ou `npm run corpus:reindex:minimal`.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
