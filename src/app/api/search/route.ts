/**
 * Busca global do app (`/busca`).
 *
 * Estratégia:
 *  1. Resultados internos do workspace: processos, peças, documentos.
 *  2. Corpus jurídico oficial: `LegalChunk` (canônico, populado pelos
 *     providers Planalto/LexML/STF/STJ).
 *  3. Vetorial (Qdrant `lex_main`) só como reforço para documentos do
 *     usuário, com filtros anti-poluição.
 *
 * Em produção, `legalChunkProductionWhere()` esconde chunks de
 * `sourceProvider=FIXTURE` ou normas com `identifier`/`title` contendo
 * `DEMO`/`FIXTURE`. A tabela legacy `LegalSource` foi removida no reset
 * canônico (branch `corpus/canonical-rebuild`).
 */

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";
import { embedQuery } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import {
  DEMO_TOKEN_REGEX,
  isProductionVisibleSource,
  legalChunkProductionWhere,
  shouldBypassDemoVisibility,
} from "@/lib/corpus/source-visibility";
import type { SearchHit } from "@/types/search";

const IS_PROD = process.env.NODE_ENV === "production";
const MIN_CHUNK_CHARS = 60;

function isPollutedText(text: string | null | undefined): boolean {
  if (!text) return true;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < MIN_CHUNK_CHARS) return true;
  if (DEMO_TOKEN_REGEX.test(cleaned)) return true;
  if (/^lorem ipsum/i.test(cleaned)) return true;
  if (/^[#=*\-]{3,}/.test(cleaned)) return true;
  return false;
}

function isPollutedCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return DEMO_TOKEN_REGEX.test(code);
}

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "12")));
  const bypassDemo = shouldBypassDemoVisibility({
    searchParams,
    isProduction: IS_PROD,
  });
  if (q.length < 2) {
    return NextResponse.json({ hits: [] satisfies SearchHit[], hadOfficialCorpus: false });
  }

  const hits: SearchHit[] = [];

  // 4 queries independentes em paralelo, com `select` explícito pra evitar
  // overfetch (especialmente em LegalPiece.contentJson e LegalChunk.text).
  const legalChunkWhere: Prisma.LegalChunkWhereInput = {
    text: { contains: q, mode: "insensitive" as const },
    ...(bypassDemo ? {} : legalChunkProductionWhere()),
  };

  const [processes, pieces, docs, officialChunksOrErr] = await Promise.all([
    prisma.process.findMany({
      where: {
        workspaceId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { number: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        number: true,
        updatedAt: true,
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.legalPiece.findMany({
      where: { workspaceId, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, kind: true },
      take: limit,
    }),
    prisma.document.findMany({
      where: { workspaceId, originalName: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        originalName: true,
        status: true,
        processId: true,
      },
      take: limit,
    }),
    // Corpus jurídico oficial (LegalChunk). Resolve com try-catch em vez de
    // allSettled pra não derrubar a busca se a query falhar.
    prisma.legalChunk
      .findMany({
        where: legalChunkWhere,
        select: {
          id: true,
          text: true,
          articleRef: true,
          fullPath: true,
          norm: {
            select: {
              id: true,
              urn: true,
              title: true,
              identifier: true,
              sourceUrl: true,
              sourceProvider: true,
              tribunal: true,
              kind: true,
            },
          },
        },
        take: limit,
      })
      .catch((e) => e as Error),
  ]);

  for (const p of processes) {
    hits.push({
      id: p.id,
      type: "processo",
      title: p.title ?? p.number,
      subtitle: p.number,
      href: `/processos/${p.id}`,
    });
  }

  for (const p of pieces) {
    hits.push({
      id: p.id,
      type: "peça",
      title: p.title,
      subtitle: p.kind,
      href: `/editor/${p.id}`,
    });
  }

  for (const d of docs) {
    hits.push({
      id: d.id,
      type: "documento",
      title: d.originalName,
      subtitle: d.status,
      href: d.processId ? `/processos/${d.processId}/documentos` : `/processos`,
    });
  }

  let hadOfficialCorpus = false;
  if (officialChunksOrErr instanceof Error) {
    console.warn("[search] corpus oficial falhou:", officialChunksOrErr.message);
  } else {
    const officialChunks = officialChunksOrErr;
    hadOfficialCorpus = officialChunks.length > 0;

    for (const c of officialChunks) {
      if (
        !bypassDemo &&
        !isProductionVisibleSource({
          identifier: c.norm.identifier ?? null,
          title: c.norm.title,
          sourceProvider: c.norm.sourceProvider,
        })
      ) {
        continue;
      }
      if (isPollutedText(c.text) && !bypassDemo) continue;
      const article = c.fullPath ?? c.articleRef ?? "";
      const head = `${c.norm.identifier ?? c.norm.title}${article ? ` — ${article}` : ""}`;
      hits.push({
        id: c.id,
        type: c.norm.kind?.toString().startsWith("JURISPRUDENCE") || c.norm.kind?.toString().startsWith("SUMULA") ? "jurisprudência" : "lei",
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
        href: `/biblioteca?id=${c.norm.id}`,
      });
    }
  }

  // Vetorial (lex_main) — só pra documentos de usuário, com filtros
  // anti-poluição. Corpus jurídico nunca passa por aqui no caminho canônico.
  try {
    const vec = await embedQuery(q);
    const store = getQdrantVectorStore();
    const vecHits = await store.search({
      vector: vec,
      workspaceIds: [workspaceId, GLOBAL_WORKSPACE_ID],
      limit: 8,
    });
    for (const h of vecHits) {
      if (!bypassDemo && isPollutedText(h.payload.chunkText)) continue;
      if (!bypassDemo && isPollutedCode(h.payload.sourceCode)) continue;
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
