/**
 * Busca global do app (`/busca`).
 *
 * Estratégia:
 *  1. Resultados internos do workspace: processos, peças, documentos.
 *  2. Corpus jurídico oficial: prioriza `LegalChunk` (corpus mínimo
 *     verificado) sobre o `LegalSource` legado.
 *  3. Vetorial (Qdrant `lex_main`) só como fallback, com filtros
 *     anti-poluição (sem DEMO/FIXTURE, mínimo de tamanho, etc.).
 *
 * Em produção, escondemos qualquer chunk vindo de `FIXTURE` ou com
 * `code`/`sourceCode` contendo `DEMO`/`FIXTURE`/`STF-RE-DEMO`. Isso
 * descontamina a busca enquanto o corpus oficial não está completo.
 */

import { NextResponse } from "next/server";
import { CorpusProvider, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";
import { embedQuery } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import type { SearchHit } from "@/types/search";

const IS_PROD = process.env.NODE_ENV === "production";
const DEMO_REGEX = /\b(DEMO|FIXTURE|TEST(E)?|EXEMPLO)\b/i;
const STF_DEMO_REGEX = /STF-RE-DEMO|RE-DEMO-\d+/i;
const MIN_CHUNK_CHARS = 60;

function isPollutedText(text: string | null | undefined): boolean {
  if (!text) return true;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < MIN_CHUNK_CHARS) return true;
  if (STF_DEMO_REGEX.test(cleaned)) return true;
  // chunks que parecem "explicação do sistema" ou placeholders
  if (/^lorem ipsum/i.test(cleaned)) return true;
  if (/^[#=*\-]{3,}/.test(cleaned)) return true;
  return false;
}

function isPollutedCode(code: string | null | undefined): boolean {
  if (!code) return false;
  if (DEMO_REGEX.test(code)) return true;
  if (STF_DEMO_REGEX.test(code)) return true;
  return false;
}

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "12")));
  const showAll = searchParams.get("all") === "1";
  if (q.length < 2) {
    return NextResponse.json({ hits: [] satisfies SearchHit[], hadOfficialCorpus: false });
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

  // Corpus jurídico oficial (LegalChunk) — preferencial sobre LegalSource.
  let hadOfficialCorpus = false;
  try {
    const officialChunks = await prisma.legalChunk.findMany({
      where: {
        text: { contains: q, mode: "insensitive" },
        norm: showAll
          ? undefined
          : {
              sourceProvider: { not: CorpusProvider.FIXTURE },
            },
      },
      include: {
        norm: {
          select: {
            id: true,
            urn: true,
            title: true,
            identifier: true,
            sourceUrl: true,
            sourceProvider: true,
            tribunal: true,
          },
        },
      },
      take: limit,
    });
    hadOfficialCorpus = officialChunks.length > 0;

    for (const c of officialChunks) {
      if (isPollutedText(c.text) && !showAll) continue;
      const article = c.fullPath ?? c.articleRef ?? "";
      const head = `${c.norm.identifier ?? c.norm.title}${article ? ` — ${article}` : ""}`;
      hits.push({
        id: c.id,
        type: "lei",
        title: head,
        subtitle: c.norm.title,
        excerpt: c.text.slice(0, 600),
        identifier: c.norm.identifier ?? undefined,
        articleRef: c.articleRef ?? undefined,
        fullPath: c.fullPath ?? undefined,
        sourceUrl: c.norm.sourceUrl ?? undefined,
        normUrn: c.norm.urn,
        provider: c.norm.sourceProvider,
        score: undefined,
        href: undefined,
      });
    }
  } catch (e) {
    console.warn("[search] corpus oficial falhou:", (e as Error).message);
  }

  // LegalSource (legado) — descontaminado em produção.
  const legalWhere: Prisma.LegalSourceWhereInput = {
    OR: [
      { code: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
    ],
  };
  if (IS_PROD && !showAll) {
    // Postgres ILIKE — pegamos qualquer caso de DEMO/FIXTURE no `code`.
    legalWhere.AND = [
      { NOT: { code: { contains: "DEMO" } } },
      { NOT: { code: { contains: "demo" } } },
      { NOT: { code: { contains: "FIXTURE" } } },
      { NOT: { code: { contains: "fixture" } } },
    ];
  }
  const legal = await prisma.legalSource.findMany({
    where: legalWhere,
    take: limit,
  });
  for (const l of legal) {
    if (!showAll && isPollutedCode(l.code)) continue;
    if (!showAll && isPollutedText(l.body)) continue;
    hits.push({
      id: l.id,
      type: l.layer === "legislation" ? "legislação" : "jurisprudência",
      title: `${l.code} ${l.articleRef ?? ""}`.trim(),
      subtitle: l.tribunal ?? undefined,
      excerpt: l.body?.slice(0, 600),
      href: `/biblioteca?id=${l.id}`,
    });
  }

  // Vetorial (lex_main) — só como reforço, com filtros anti-poluição.
  try {
    const vec = await embedQuery(q);
    const store = getQdrantVectorStore();
    const vecHits = await store.search({
      vector: vec,
      workspaceIds: [workspaceId, GLOBAL_WORKSPACE_ID],
      limit: 8,
    });
    for (const h of vecHits) {
      if (!showAll && isPollutedText(h.payload.chunkText)) continue;
      if (!showAll && isPollutedCode(h.payload.sourceCode)) continue;
      const preview = h.payload.chunkText.slice(0, 80);
      hits.push({
        id: h.id,
        type: "vetorial",
        title: preview + (h.payload.chunkText.length > 80 ? "…" : ""),
        subtitle: h.payload.sourceCode ?? h.payload.articleRef,
        excerpt: h.payload.chunkText.slice(0, 600),
        score: typeof h.score === "number" ? h.score : undefined,
      });
    }
  } catch {
    // Qdrant/embed opcional em dev
  }

  return NextResponse.json({
    hits: hits.slice(0, limit),
    hadOfficialCorpus,
  });
}
