import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";
import { embedQuery } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import type { SearchHit } from "@/types/search";

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "12")));
  if (q.length < 2) {
    return NextResponse.json({ hits: [] satisfies SearchHit[] });
  }

  const hits: SearchHit[] = [];

  const processes = await prisma.process.findMany({
    where: {
      workspaceId,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { number: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  for (const p of processes) {
    hits.push({
      id: p.id,
      type: "processo",
      title: p.title ?? p.number,
      subtitle: p.number,
      href: `/processos/${p.id}`,
    });
  }

  const pieces = await prisma.legalPiece.findMany({
    where: { workspaceId, title: { contains: q, mode: "insensitive" } },
    take: limit,
  });
  for (const p of pieces) {
    hits.push({
      id: p.id,
      type: "peça",
      title: p.title,
      subtitle: p.kind,
      href: `/editor/${p.id}`,
    });
  }

  const docs = await prisma.document.findMany({
    where: { workspaceId, originalName: { contains: q, mode: "insensitive" } },
    take: limit,
  });
  for (const d of docs) {
    hits.push({
      id: d.id,
      type: "documento",
      title: d.originalName,
      subtitle: d.status,
      href: d.processId ? `/processos/${d.processId}/documentos` : `/processos`,
    });
  }

  const legal = await prisma.legalSource.findMany({
    where: {
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
  });
  for (const l of legal) {
    hits.push({
      id: l.id,
      type: l.layer === "legislation" ? "legislação" : "jurisprudência",
      title: `${l.code} ${l.articleRef ?? ""}`.trim(),
      subtitle: l.tribunal ?? undefined,
      href: `/biblioteca?id=${l.id}`,
    });
  }

  try {
    const vec = await embedQuery(q);
    const store = getQdrantVectorStore();
    const vecHits = await store.search({
      vector: vec,
      workspaceIds: [workspaceId, GLOBAL_WORKSPACE_ID],
      limit: 8,
    });
    for (const h of vecHits) {
      const preview = h.payload.chunkText.slice(0, 80);
      hits.push({
        id: h.id,
        type: `vetorial:${h.payload.layer}`,
        title: preview + (h.payload.chunkText.length > 80 ? "…" : ""),
        subtitle: h.payload.sourceCode ?? h.payload.articleRef,
        href: `/busca?q=${encodeURIComponent(q)}`,
      });
    }
  } catch {
    // Qdrant/embed opcional em dev
  }

  return NextResponse.json({ hits: hits.slice(0, limit) });
}
