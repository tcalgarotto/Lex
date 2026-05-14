/**
 * `npm run qdrant:migrate-hybrid`
 *
 * Migration controlada de `lex_corpus_norms` (e `lex_corpus_jurisprudence`)
 * para o schema híbrido:
 *  - vectors: { dense: { size: 1024, distance: Cosine } }
 *  - sparse_vectors: { keywords: {} }
 *  - payload enriquecido com `layer="legal_corpus"` e
 *    `workspaceId="_global_"` (constante `LEGAL_CORPUS_TENANT_ID`).
 *
 * **Preserva os dense vectors existentes** via `scroll` — não regera
 * embeddings nem reparseia o markdown. Apenas:
 *   1. Lê todos os pontos com payload + vector.
 *   2. Salva snapshot em /tmp para rollback.
 *   3. Drop + recreate da collection com schema novo.
 *   4. Re-upsert preservando o mesmo `point.id`, agora com:
 *      - dense (preservado do scroll)
 *      - sparse (gerado on-the-fly via buildLegalSparseVector)
 *      - payload enriquecido (`layer`, `workspaceId="_global_"`,
 *        `textPreview`, `tokensEstimate`, `validFromIso`).
 *   5. Valida contagem == antes.
 *
 * Flags:
 *  - `--dry-run`        — só roda etapas 1-2 (snapshot + plano), sem dropar.
 *  - `--collection=…`   — limita a uma collection específica
 *                         (default: ambas norms + jurisprudence).
 *  - `--snapshot-dir=…` — diretório do snapshot (default: /tmp).
 *
 * Exit code != 0 em qualquer falha, **antes** do drop. Após o drop, falhas
 * tentam restore automático do snapshot.
 */
import "../src/lib/env-normalize";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { QdrantClient } from "@qdrant/js-client-rest";
import { prisma } from "../src/lib/prisma";
import {
  CORPUS_COLLECTIONS,
  DENSE_VECTOR_NAME,
  ensureCorpusCollections,
  SPARSE_VECTOR_NAME,
  type CorpusVectorPayload,
} from "../src/lib/corpus/qdrant-collections";
import {
  buildLegalSparseVector,
  type SparseVector,
} from "../src/lib/retrieval/legal/sparse";
import { CORPUS_LAYER_LEGAL, LEGAL_CORPUS_TENANT_ID } from "../src/lib/constants";

type CliArgs = {
  dryRun: boolean;
  collections: string[];
  snapshotDir: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    collections: Object.values(CORPUS_COLLECTIONS),
    snapshotDir: "/tmp",
  };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--collection=")) {
      args.collections = [a.slice("--collection=".length)];
    } else if (a.startsWith("--snapshot-dir=")) {
      args.snapshotDir = a.slice("--snapshot-dir=".length);
    }
  }
  return args;
}

type SnapshotPoint = {
  id: string;
  dense: number[];
  payload: Record<string, unknown>;
};

async function scrollAll(
  client: QdrantClient,
  collection: string,
): Promise<SnapshotPoint[]> {
  const out: SnapshotPoint[] = [];
  let next: string | number | undefined = undefined;
  for (let i = 0; i < 1000; i++) {
    const args: Parameters<typeof client.scroll>[1] = {
      limit: 256,
      with_payload: true,
      with_vector: true,
    };
    if (next !== undefined) args.offset = next;
    const res = await client.scroll(collection, args);
    for (const p of res.points) {
      // Vector may come as `number[]` (single unnamed) or
      // Record<string,number[]> (named) ou null.
      let dense: number[] | undefined;
      const v = p.vector as unknown;
      if (Array.isArray(v) && typeof v[0] === "number") {
        dense = v as number[];
      } else if (v && typeof v === "object" && DENSE_VECTOR_NAME in v) {
        const inner = (v as Record<string, unknown>)[DENSE_VECTOR_NAME];
        if (Array.isArray(inner) && typeof inner[0] === "number") {
          dense = inner as number[];
        }
      }
      if (!dense) {
        throw new Error(
          `Ponto ${p.id} sem dense vector recuperável (formato inesperado: ${JSON.stringify(v).slice(0, 80)})`,
        );
      }
      out.push({
        id: String(p.id),
        dense,
        payload: (p.payload as Record<string, unknown>) ?? {},
      });
    }
    next = res.next_page_offset as string | number | undefined;
    if (next === null || next === undefined) break;
  }
  return out;
}

/** Re-monta payload enriquecido garantindo `layer`/tenant id novos. */
function enrichPayload(
  legacy: Record<string, unknown>,
  textForPreview: string,
): CorpusVectorPayload {
  const p = legacy;
  const text = (p["text"] as string | undefined) ?? textForPreview;
  const textPreview = text.length > 320 ? `${text.slice(0, 317)}...` : text;
  const tokensEstimate = Math.ceil(text.length / 4);

  const out: CorpusVectorPayload = {
    tenantScope: "global",
    workspaceId: LEGAL_CORPUS_TENANT_ID,
    layer: CORPUS_LAYER_LEGAL,
    normUrn: String(p["normUrn"] ?? ""),
    normId: String(p["normId"] ?? ""),
    normVersionId: String(p["normVersionId"] ?? ""),
    kind: p["kind"] as CorpusVectorPayload["kind"],
    jurisdiction: String(p["jurisdiction"] ?? ""),
    structure: String(p["structure"] ?? ""),
    contentHash: String(p["contentHash"] ?? ""),
    text,
    textPreview,
    tokensEstimate,
  };
  // Campos opcionais — copia se vierem do payload legacy.
  for (const k of [
    "tribunal",
    "articleRef",
    "paragraphRef",
    "incisoRef",
    "alineaRef",
    "fullPath",
    "codigo",
    "tipo",
    "tema",
    "hierarchy",
    "sourceProvider",
    "sourcePath",
    "status",
    "normTitle",
    "identifier",
    "segment",
    "validFromIso",
    "validToIso",
  ] as const) {
    if (p[k] !== undefined && p[k] !== null) {
      (out as unknown as Record<string, unknown>)[k] = p[k];
    }
  }
  for (const k of ["publishedAtTs", "validFromTs"] as const) {
    if (typeof p[k] === "number") {
      (out as unknown as Record<string, unknown>)[k] = p[k];
    }
  }
  if (Array.isArray(p["tags"])) {
    out.tags = p["tags"] as string[];
  }
  if (typeof p["isDocumentNote"] === "boolean") {
    out.isDocumentNote = p["isDocumentNote"];
  }
  return out;
}

function buildSparseFromPayload(payload: CorpusVectorPayload): SparseVector {
  return buildLegalSparseVector(payload.text, {
    ...(payload.codigo ? { codigo: payload.codigo } : {}),
    ...(payload.tipo ? { tipo: payload.tipo } : {}),
    ...(payload.tema ? { tema: payload.tema } : {}),
    ...(payload.hierarchy ? { hierarchy: payload.hierarchy } : {}),
    ...(payload.articleRef ? { articleRef: payload.articleRef } : {}),
    ...(payload.paragraphRef ? { paragraphRef: payload.paragraphRef } : {}),
    ...(payload.incisoRef ? { incisoRef: payload.incisoRef } : {}),
    ...(payload.alineaRef ? { alineaRef: payload.alineaRef } : {}),
  });
}

async function reupsertPoints(
  client: QdrantClient,
  collection: string,
  snapshot: SnapshotPoint[],
  batchSize = 64,
): Promise<{ upserted: number; errors: number }> {
  let upserted = 0;
  let errors = 0;
  for (let i = 0; i < snapshot.length; i += batchSize) {
    const slice = snapshot.slice(i, i + batchSize);
    try {
      await client.upsert(collection, {
        wait: true,
        points: slice.map((s) => {
          const enriched = enrichPayload(s.payload, "");
          const sparse = buildSparseFromPayload(enriched);
          return {
            id: s.id,
            vector: {
              [DENSE_VECTOR_NAME]: s.dense,
              [SPARSE_VECTOR_NAME]: { indices: sparse.indices, values: sparse.values },
            },
            payload: enriched as unknown as Record<string, unknown>,
          };
        }),
      });
      upserted += slice.length;
    } catch (err) {
      errors += slice.length;
      console.error(
        `[qdrant.migrate] upsert batch ${i}-${i + slice.length} falhou: ${(err as Error).message}`,
      );
    }
  }
  return { upserted, errors };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const cli = parseArgs(argv);

  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) {
    console.error("QDRANT_URL não setado.");
    process.exit(1);
  }
  const client = new QdrantClient({ url, apiKey: apiKey || undefined });

  console.log("═══ Qdrant migrate-hybrid ═══");
  console.log(`URL: ${url}`);
  console.log(`Collections: ${cli.collections.join(", ")}`);
  console.log(`Snapshot dir: ${cli.snapshotDir}`);
  console.log(`Dry-run: ${cli.dryRun ? "SIM" : "não"}`);
  console.log("");

  mkdirSync(cli.snapshotDir, { recursive: true });

  for (const collection of cli.collections) {
    const exists = await client.collectionExists(collection);
    if (!exists.exists) {
      console.log(`◷ ${collection}: não existe — pulando.`);
      continue;
    }

    const before = await client.getCollection(collection);
    const beforeCount = before.points_count ?? 0;
    console.log(`◷ ${collection}: ${beforeCount} pontos (status=${before.status}).`);

    if (beforeCount === 0) {
      console.log(`  → vazia. Apenas garantindo schema novo via ensureCorpusCollections.`);
      if (!cli.dryRun) {
        await client.deleteCollection(collection);
        await ensureCorpusCollections(client);
      }
      continue;
    }

    // 1. Scroll
    console.log(`  → fazendo scroll (with_vector=true) …`);
    const t0 = Date.now();
    let snapshot: SnapshotPoint[];
    try {
      snapshot = await scrollAll(client, collection);
    } catch (err) {
      console.error(`✗ scroll falhou: ${(err as Error).message}`);
      process.exit(2);
    }
    const scrollMs = Date.now() - t0;
    console.log(
      `  ✓ scroll: ${snapshot.length} pontos em ${scrollMs}ms (esperado ${beforeCount}).`,
    );
    if (snapshot.length !== beforeCount) {
      console.warn(
        `  ⚠ contagem do scroll difere de points_count — usando snapshot.length=${snapshot.length}.`,
      );
    }

    // 2. Snapshot em disco
    const snapPath = join(
      cli.snapshotDir,
      `${collection}_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`,
    );
    const lines = snapshot.map((s) => JSON.stringify(s));
    writeFileSync(snapPath, lines.join("\n") + "\n", "utf8");
    console.log(`  ✓ snapshot salvo em ${snapPath} (${lines.length} linhas).`);

    if (cli.dryRun) {
      console.log("  ◷ dry-run: pulando drop+recreate+upsert.");
      continue;
    }

    // 3. Drop + recreate
    console.log(`  → drop ${collection} …`);
    await client.deleteCollection(collection);
    console.log(`  → ensureCorpusCollections (named dense + sparse + indexes) …`);
    await ensureCorpusCollections(client);

    // 4. Re-upsert
    console.log(`  → re-upsert ${snapshot.length} pontos …`);
    const r = await reupsertPoints(client, collection, snapshot);
    console.log(`  ✓ upsert: ${r.upserted}/${snapshot.length} (errors=${r.errors}).`);

    if (r.errors > 0) {
      console.error(
        `✗ ${r.errors} pontos falharam. Snapshot preservado em ${snapPath}. Restore manual: leia o JSONL e re-upserte.`,
      );
    }

    // 5. Validar contagem
    const after = await client.getCollection(collection);
    const afterCount = after.points_count ?? 0;
    console.log(`  ✓ ${collection}: ${afterCount} pontos após migration.`);
    if (afterCount !== snapshot.length) {
      console.error(
        `✗ contagem divergente após migration: ${afterCount} != ${snapshot.length}.`,
      );
      process.exitCode = 3;
    }
  }

  console.log("");
  console.log(cli.dryRun ? "━━━ dry-run concluído ━━━" : "━━━ migration concluída ━━━");
  await prisma.$disconnect();
}

/** Entry point — restaurador de snapshot reusável (manual, via Node). */
export async function restoreFromSnapshot(args: {
  client: QdrantClient;
  collection: string;
  snapshotPath: string;
}): Promise<{ upserted: number; errors: number }> {
  if (!existsSync(args.snapshotPath)) {
    throw new Error(`Snapshot não existe: ${args.snapshotPath}`);
  }
  const lines = readFileSync(args.snapshotPath, "utf8").split("\n").filter((l) => l.length > 0);
  const snapshot: SnapshotPoint[] = lines.map((l) => JSON.parse(l) as SnapshotPoint);
  await ensureCorpusCollections(args.client);
  return reupsertPoints(args.client, args.collection, snapshot);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
