/**
 * `npm run qdrant:ensure-indexes`
 *
 * Garante (idempotente) que todas as collections do corpus jurídico
 * existam com o schema canônico e que os payload indexes — incluindo o
 * `workspaceId` com `is_tenant=true` — estejam instalados.
 *
 * Não dropa, não recria, não toca payload de pontos. Apenas
 * `createCollection` (se faltar) + `createPayloadIndex` em loop. Erros
 * "already exists" são tolerados.
 *
 * Use depois de `qdrant:migrate-hybrid` ou em rotinas de deploy para
 * convergir o estado.
 */
import "../src/lib/env-normalize";
import { QdrantClient } from "@qdrant/js-client-rest";
import { ensureCorpusCollections } from "../src/lib/corpus/qdrant-collections";

async function main(): Promise<void> {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) {
    console.error("QDRANT_URL não setado.");
    process.exit(1);
  }
  const client = new QdrantClient({ url, apiKey: apiKey || undefined });

  console.log("═══ Qdrant ensure-indexes ═══");
  console.log(`URL: ${url}`);

  const t0 = Date.now();
  await ensureCorpusCollections(client);
  console.log(`✓ ensureCorpusCollections concluído em ${Date.now() - t0}ms.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
