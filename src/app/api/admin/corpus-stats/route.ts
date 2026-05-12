/**
 * `GET /api/admin/corpus-stats`
 *
 * Endpoint admin (apenas OWNER do workspace ativo) com snapshot do corpus
 * jurídico nacional + status de provedores. Usado pela página
 * `/settings/readiness` (cards de provider) e por scripts CI quando precisam
 * snapshot remoto do corpus.
 *
 * Apenas leitura. Não causa side-effects.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { snapshotProviderStatuses } from "@/lib/corpus/providers/registry";
import { CORPUS_COLLECTIONS } from "@/lib/corpus/qdrant-collections";

export const runtime = "nodejs";

async function probeQdrantCounts(): Promise<Record<string, number | string>> {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) return { _info: "QDRANT_URL not set" };
  const out: Record<string, number | string> = {};
  for (const collection of Object.values(CORPUS_COLLECTIONS)) {
    try {
      const res = await fetch(`${url}/collections/${collection}`, {
        headers: apiKey ? { "api-key": apiKey } : {},
        cache: "no-store",
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

export async function GET() {
  try {
    await requirePermission("observabilityView");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Permissão insuficiente")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [norms, versions, chunks, citations, watermarks, recentJobs] =
    await Promise.all([
      prisma.legalNorm.count(),
      prisma.legalNormVersion.count(),
      prisma.legalChunk.count(),
      prisma.legalCitation.count(),
      prisma.ingestionWatermark.findMany({
        orderBy: [{ provider: "asc" }, { kind: "asc" }],
      }),
      prisma.ingestionJob.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ]);

  const byKind = await prisma.legalNorm
    .groupBy({ by: ["kind"], _count: true, orderBy: { _count: { kind: "desc" } } })
    .catch(() => []);

  const byTribunal = await prisma.legalNorm
    .groupBy({
      by: ["tribunal"],
      _count: true,
      orderBy: { _count: { tribunal: "desc" } },
      take: 20,
    })
    .catch(() => []);

  const providerStatuses = snapshotProviderStatuses();
  const qdrant = await probeQdrantCounts();

  return NextResponse.json({
    totals: { norms, versions, chunks, citations },
    byKind: byKind.map((k) => ({ kind: k.kind, count: k._count })),
    byTribunal: byTribunal.map((t) => ({
      tribunal: t.tribunal ?? "<sem tribunal>",
      count: t._count,
    })),
    watermarks: watermarks.map((w) => ({
      provider: w.provider,
      kind: w.kind,
      cursor: w.cursor ?? null,
      lastSyncAt: w.lastSyncAt?.toISOString() ?? null,
      itemsTotal: w.itemsTotal,
    })),
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      provider: j.provider,
      kind: j.kind ?? null,
      status: j.status,
      startedAt: j.startedAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
      itemsProcessed: j.itemsProcessed,
      errorMessage: j.errorMessage,
    })),
    providers: providerStatuses,
    qdrant,
    timestamp: new Date().toISOString(),
  });
}
