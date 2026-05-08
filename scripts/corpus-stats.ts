/**
 * `npm run corpus:stats`
 *
 * Snapshot do corpus jurídico:
 *  - total LegalNorm / LegalNormVersion / LegalChunk / LegalCitation
 *  - quebra por provider, kind, tribunal
 *  - últimas IngestionJobs e watermarks
 *  - status de cada provider (registry)
 *  - contagem opcional no Qdrant (se QDRANT_URL setado)
 *
 * Exit 0 sempre (não bloqueia CI). É puramente diagnóstico.
 */

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { snapshotProviderStatuses } from "../src/lib/corpus/providers/registry";
import { CORPUS_COLLECTIONS } from "../src/lib/corpus/qdrant-collections";

type Stats = {
  totals: { norms: number; versions: number; chunks: number; citations: number };
  byKind: Array<{ kind: string; count: number }>;
  byTribunal: Array<{ tribunal: string; count: number }>;
  byProviderJob: Array<{ provider: string; jobs: number; itemsTotal: number }>;
  watermarks: Array<{
    provider: string;
    kind: string;
    cursor: string | null;
    lastSyncAt: string | null;
    items: number;
  }>;
  recentJobs: Array<{
    id: string;
    provider: string;
    kind: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    items: number;
    error?: string | null;
  }>;
};

async function readPrismaStats(): Promise<Stats> {
  const [norms, versions, chunks, citations] = await Promise.all([
    prisma.legalNorm.count(),
    prisma.legalNormVersion.count(),
    prisma.legalChunk.count(),
    prisma.legalCitation.count(),
  ]);

  const byKindRaw = await prisma.$queryRawUnsafe<
    Array<{ kind: string; count: bigint }>
  >(
    `select kind::text, count(*)::bigint as count
       from "LegalNorm"
      group by kind
      order by count desc`,
  ).catch(() => [] as Array<{ kind: string; count: bigint }>);

  const byTribunalRaw = await prisma.$queryRawUnsafe<
    Array<{ tribunal: string; count: bigint }>
  >(
    `select coalesce(tribunal, '<sem tribunal>') as tribunal, count(*)::bigint as count
       from "LegalNorm"
      group by 1
      order by 2 desc
      limit 20`,
  ).catch(() => [] as Array<{ tribunal: string; count: bigint }>);

  const byProviderRaw = await prisma.$queryRawUnsafe<
    Array<{ provider: string; jobs: bigint; items: bigint }>
  >(
    `select provider::text, count(*)::bigint as jobs,
            coalesce(sum("itemsProcessed"), 0)::bigint as items
       from "IngestionJob"
      group by provider
      order by jobs desc`,
  ).catch(() => [] as Array<{ provider: string; jobs: bigint; items: bigint }>);

  const watermarks = await prisma.ingestionWatermark
    .findMany({
      orderBy: [{ provider: "asc" }, { kind: "asc" }],
      take: 50,
    })
    .catch(() => []);

  const recentJobs = await prisma.ingestionJob
    .findMany({ orderBy: { startedAt: "desc" }, take: 10 })
    .catch(() => []);

  return {
    totals: { norms, versions, chunks, citations },
    byKind: byKindRaw.map((r) => ({ kind: r.kind, count: Number(r.count) })),
    byTribunal: byTribunalRaw.map((r) => ({
      tribunal: r.tribunal,
      count: Number(r.count),
    })),
    byProviderJob: byProviderRaw.map((r) => ({
      provider: r.provider,
      jobs: Number(r.jobs),
      itemsTotal: Number(r.items),
    })),
    watermarks: watermarks.map((w) => ({
      provider: w.provider,
      kind: w.kind,
      cursor: w.cursor ?? null,
      lastSyncAt: w.lastSyncAt?.toISOString() ?? null,
      items: w.itemsTotal,
    })),
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      provider: j.provider,
      kind: j.kind ?? null,
      status: j.status,
      startedAt: j.startedAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
      items: j.itemsProcessed,
      error: j.errorMessage,
    })),
  };
}

async function readQdrantCounts(): Promise<Record<string, number | string>> {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) return { _info: "QDRANT_URL não setado, pulando" };
  const out: Record<string, number | string> = {};
  for (const collection of Object.values(CORPUS_COLLECTIONS)) {
    try {
      const res = await fetch(`${url}/collections/${collection}`, {
        headers: apiKey ? { "api-key": apiKey } : {},
      });
      if (!res.ok) {
        out[collection] = `HTTP ${res.status}`;
        continue;
      }
      const json = (await res.json()) as { result?: { points_count?: number } };
      out[collection] = json.result?.points_count ?? 0;
    } catch (err) {
      out[collection] = `error: ${(err as Error).message}`;
    }
  }
  return out;
}

async function main() {
  console.log("== Corpus stats ==");
  console.log("Conectando ao Postgres...");
  let stats: Stats;
  try {
    stats = await readPrismaStats();
  } catch (err) {
    console.error("Falha ao ler Postgres:", (err as Error).message);
    process.exit(0);
  }

  console.log("");
  console.log("[Totais]");
  console.table(stats.totals);

  console.log("");
  console.log("[Por kind]");
  console.table(stats.byKind);

  if (stats.byTribunal.length > 0) {
    console.log("");
    console.log("[Top tribunais]");
    console.table(stats.byTribunal);
  }

  if (stats.byProviderJob.length > 0) {
    console.log("");
    console.log("[Jobs por provider]");
    console.table(stats.byProviderJob);
  }

  if (stats.watermarks.length > 0) {
    console.log("");
    console.log("[Watermarks]");
    console.table(stats.watermarks);
  }

  if (stats.recentJobs.length > 0) {
    console.log("");
    console.log("[Últimos 10 jobs]");
    console.table(stats.recentJobs);
  }

  console.log("");
  console.log("[Provider statuses (registry)]");
  console.table(snapshotProviderStatuses());

  console.log("");
  console.log("[Qdrant points_count]");
  const qdrant = await readQdrantCounts();
  console.table(qdrant);

  console.log("");
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("corpus:stats fatal:", e);
  process.exit(1);
});
