/**
 * `npm run qdrant:inspect-indexes`
 *
 * Imprime tabela com payload indexes de cada collection do corpus,
 * destacando indexes ausentes em relação à lista canônica.
 *
 * Útil para conferir após migration / deploy.
 */
import "../src/lib/env-normalize";
import { QdrantClient } from "@qdrant/js-client-rest";
import { CORPUS_COLLECTIONS } from "../src/lib/corpus/qdrant-collections";

const EXPECTED_FIELDS = [
  "workspaceId",
  "tenantScope",
  "layer",
  "normUrn",
  "normId",
  "normVersionId",
  "kind",
  "jurisdiction",
  "tribunal",
  "structure",
  "articleRef",
  "paragraphRef",
  "incisoRef",
  "alineaRef",
  "publishedAtTs",
  "validFromTs",
  "contentHash",
  "tags",
  "codigo",
  "tipo",
  "tema",
  "sourceProvider",
  "status",
  "textPreview",
] as const;

type CollectionInfo = {
  name: string;
  exists: boolean;
  pointsCount?: number;
  payloadIndexes?: Record<string, unknown>;
  vectorsConfig?: unknown;
  sparseConfig?: unknown;
};

async function describe(client: QdrantClient, name: string): Promise<CollectionInfo> {
  const exists = await client.collectionExists(name);
  if (!exists.exists) {
    return { name, exists: false };
  }
  const info = (await client.getCollection(name)) as unknown as {
    points_count?: number;
    payload_schema?: Record<string, unknown>;
    config?: {
      params?: {
        vectors?: unknown;
        sparse_vectors?: unknown;
      };
    };
  };
  return {
    name,
    exists: true,
    pointsCount: info.points_count,
    payloadIndexes: info.payload_schema ?? {},
    vectorsConfig: info.config?.params?.vectors,
    sparseConfig: info.config?.params?.sparse_vectors,
  };
}

async function main(): Promise<void> {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) {
    console.error("QDRANT_URL não setado.");
    process.exit(1);
  }
  const client = new QdrantClient({ url, apiKey: apiKey || undefined });

  console.log("═══ Qdrant inspect-indexes ═══");
  console.log(`URL: ${url}`);
  console.log("");

  for (const collection of Object.values(CORPUS_COLLECTIONS)) {
    const info = await describe(client, collection);
    if (!info.exists) {
      console.log(`✗ ${collection}: collection ausente.`);
      continue;
    }
    console.log(`◆ ${collection} — ${info.pointsCount ?? 0} pontos`);
    console.log(`  Vetores nomeados: ${JSON.stringify(info.vectorsConfig ?? null).slice(0, 200)}`);
    console.log(`  Sparse vectors:   ${JSON.stringify(info.sparseConfig ?? null).slice(0, 200)}`);
    console.log("  Payload indexes:");
    const idx = (info.payloadIndexes ?? {}) as Record<string, unknown>;
    const present = new Set(Object.keys(idx));
    const missing: string[] = [];
    for (const field of EXPECTED_FIELDS) {
      const has = present.has(field);
      const detail = idx[field];
      const isTenant =
        detail &&
        typeof detail === "object" &&
        (detail as Record<string, unknown>)["params"] &&
        ((detail as Record<string, unknown>)["params"] as Record<string, unknown>)["is_tenant"] === true;
      const tenantTag = isTenant ? " (tenant)" : "";
      console.log(
        `    ${has ? "✓" : "✗"} ${field}${tenantTag} ${has ? "" : "  ← AUSENTE"}`,
      );
      if (!has) missing.push(field);
    }
    if (missing.length === 0) {
      console.log("  ✓ todos os indexes esperados estão presentes.");
    } else {
      console.log(
        `  ⚠ faltam ${missing.length} indexes — rode \`npm run qdrant:ensure-indexes\`.`,
      );
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
