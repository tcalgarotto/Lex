/**
 * Bootstrap idempotente das collections Qdrant do Lex.
 *
 *  - `lex_main` (legacy): documentos do usuário, multi-tenant por workspaceId.
 *  - `lex_corpus_norms` (novo): legislação federal/estadual/municipal.
 *  - `lex_corpus_jurisprudence` (novo): jurisprudência STF/STJ/TST/súmulas.
 *
 * Reexecução é segura — não recria nada que já existe.
 */
import { QdrantClient } from "@qdrant/js-client-rest";
import { ensureCorpusCollections } from "../src/lib/corpus/qdrant-collections";

const COLLECTION = process.env["QDRANT_COLLECTION"] ?? "lex_main";
const VECTOR_SIZE = 1024;

async function ensureLegacy(client: QdrantClient): Promise<void> {
  const exists = await client.collectionExists(COLLECTION);
  if (!exists.exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log(`Created collection ${COLLECTION}`);
  } else {
    console.log(`Collection ${COLLECTION} already exists`);
  }

  const indexes: Array<{
    field_name: string;
    field_schema: "keyword" | "integer" | "text";
  }> = [
    { field_name: "workspaceId", field_schema: "keyword" },
    { field_name: "layer", field_schema: "keyword" },
    { field_name: "documentId", field_schema: "keyword" },
    { field_name: "processId", field_schema: "keyword" },
    { field_name: "chunkText", field_schema: "text" },
  ];
  for (const idx of indexes) {
    try {
      await client.createPayloadIndex(COLLECTION, idx);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (!/already exists/i.test(msg)) throw err;
    }
  }
  console.log("Payload indexes ensured (legacy).");
}

async function main() {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) throw new Error("QDRANT_URL is required");

  const client = new QdrantClient({ url, apiKey: apiKey || undefined });
  await ensureLegacy(client);
  await ensureCorpusCollections(client);
  console.log("Corpus collections ensured: lex_corpus_norms, lex_corpus_jurisprudence.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
