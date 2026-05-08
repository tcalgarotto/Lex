/**
 * Busca global do app (`/busca`).
 *
 * Estratégia:
 *  1. Workspace interno: processos, peças, documentos, casos.
 *  2. Corpus jurídico oficial via `retrieveLegalContext` (hybrid + RRF).
 *     Substitui a antiga consulta direta a `LegalChunk` por substring.
 *  3. Vetorial (Qdrant `lex_main`) só como reforço para documentos do
 *     usuário, com filtros anti-poluição.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";
import { embedQuery } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import {
  DEMO_TOKEN_REGEX,
  shouldBypassDemoVisibility,
} from "@/lib/corpus/source-visibility";
import { retrieveLegalContext } from "@/lib/retrieval/legal";
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
  const scope = (searchParams.get("scope") ?? "tudo").toLowerCase();
  const bypassDemo = shouldBypassDemoVisibility({
    searchParams,
    isProduction: IS_PROD,
  });
  if (q.length < 2) {
    return NextResponse.json({
      hits: [] satisfies SearchHit[],
      hadOfficialCorpus: false,
      scope,
      query: q,
    });
  }

  const wantWorkspace = scope === "tudo" || ["casos", "documentos", "peças", "pecas"].includes(scope);
  const wantLegal = scope === "tudo" || scope === "legislação" || scope === "legislacao";

  const hits: SearchHit[] = [];

  // Queries internas do workspace em paralelo.
  const [processes, pieces, docs, cases] = await Promise.all([
    wantWorkspace
      ? prisma.process.findMany({
          where: {
            workspaceId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { number: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, title: true, number: true, updatedAt: true },
          take: limit,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    wantWorkspace
      ? prisma.legalPiece.findMany({
          where: { workspaceId, title: { contains: q, mode: "insensitive" } },
          select: { id: true, title: true, kind: true },
          take: limit,
        })
      : Promise.resolve([]),
    wantWorkspace
      ? prisma.document.findMany({
          where: { workspaceId, originalName: { contains: q, mode: "insensitive" } },
          select: {
            id: true,
            originalName: true,
            status: true,
            processId: true,
            caseId: true,
          },
          take: limit,
        })
      : Promise.resolve([]),
    wantWorkspace
      ? prisma.case.findMany({
          where: {
            workspaceId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { processNumber: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, title: true, status: true, processNumber: true },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  for (const c of cases) {
    hits.push({
      id: c.id,
      type: "caso",
      title: c.title,
      subtitle: c.processNumber ?? c.status,
      href: `/cases/${c.id}`,
    });
  }
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
      href: d.caseId
        ? `/cases/${d.caseId}#documents`
        : d.processId
          ? `/processos/${d.processId}/documentos`
          : `/documentos`,
    });
  }

  // Corpus jurídico oficial via retrieveLegalContext (hybrid + RRF).
  let hadOfficialCorpus = false;
  if (wantLegal) {
    try {
      const result = await retrieveLegalContext(q, {
        topK: 8,
        useCache: true,
        workspaceId,
      });
      hadOfficialCorpus = result.chunks.length > 0;
      for (const c of result.chunks) {
        const head = `${c.norm.identifier ?? c.norm.title}${
          c.fullPath ? ` — ${c.fullPath}` : c.articleRef ? ` — ${c.articleRef}` : ""
        }`;
        const isJurispr =
          c.norm.kind?.toString().startsWith("JURISPRUDENCE") ||
          c.norm.kind?.toString().startsWith("SUMULA");
        hits.push({
          id: c.chunkId,
          type: isJurispr ? "jurisprudência" : "lei",
          title: head,
          subtitle: c.norm.title,
          excerpt: c.text.slice(0, 600),
          identifier: c.norm.identifier ?? undefined,
          articleRef: c.articleRef ?? undefined,
          fullPath: c.fullPath ?? undefined,
          normUrn: c.norm.urn,
          score: c.scores.final,
          href: `/pesquisa-juridica?q=${encodeURIComponent(q)}`,
        });
      }
    } catch (e) {
      console.warn("[search] retrieveLegalContext falhou:", (e as Error).message);
    }
  }

  // Vetorial (lex_main) — reforço para documentos de usuário (best-effort).
  if (wantWorkspace) {
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
  }

  return NextResponse.json({
    hits: hits.slice(0, limit),
    hadOfficialCorpus,
    scope,
    query: q,
  });
}
