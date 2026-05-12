/**
 * Busca global do app (`/busca`).
 *
 * 1. Workspace (Postgres) 2. Sugestões jurídicas (DeepSeek) 3. Sem vetor/Qdrant.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getLogger } from "@/lib/logger";
import type { SearchHit } from "@/types/search";
import { getLegalResearchProvider } from "@/lib/legal-research";
import { isAnyCorpusSearchConfigMuted } from "@/lib/retrieval/lex-rag-backend";

const log = getLogger("lex.api.search");

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  return res;
}

function legalHitsFromDeepSeek(
  q: string,
  workspaceId: string,
): Promise<SearchHit[]> {
  const provider = getLegalResearchProvider();
  return provider
    .search({
      workspaceId,
      query: q,
      maxResults: 8,
      resultTypes: ["LAW", "JURISPRUDENCE"],
      language: "pt-BR",
    })
    .then((res) => {
      const dsHits: SearchHit[] = [];
      for (const f of res.legalFoundations) {
        dsHits.push({
          id: f.id,
          type: "lei",
          title: f.citation || f.title,
          subtitle: f.title,
          excerpt: f.excerpt || f.whyRelevant,
          score: f.confidence,
          href: `/pesquisa-juridica?q=${encodeURIComponent(q)}`,
        });
      }
      for (const j of res.jurisprudenceCandidates) {
        dsHits.push({
          id: j.id,
          type: "jurisprudência",
          title: j.processNumber || j.title,
          subtitle: j.court,
          excerpt: j.summary || j.excerpt,
          score: j.confidence,
          href: `/pesquisa-juridica?q=${encodeURIComponent(q)}`,
        });
      }
      return dsHits;
    });
}

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  return res;
}

export async function GET(req: Request) {
  const requestId = randomUUID();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "12")));
  const scope = (searchParams.get("scope") ?? "tudo").toLowerCase();
  if (q.length < 2) {
    return withRequestId(
      NextResponse.json({
        hits: [] satisfies SearchHit[],
        hadOfficialCorpus: false,
        scope,
        query: q,
        corpusSearchConfigMuted: isAnyCorpusSearchConfigMuted(),
      }),
      requestId,
    );
  }

  const { workspaceId } = await getWorkspaceContext();

  const wantWorkspace =
    scope === "tudo" || scope === "casos" || scope === "documentos" || scope === "peças";
  const wantLegal = scope === "tudo" || scope === "legislação";
  const hits: SearchHit[] = [];

  const [workspaceResults, legalHits] = await Promise.all([
    (async () => {
      if (!wantWorkspace) return { processes: [], pieces: [], docs: [], cases: [] };
      const [processes, pieces, docs, cases] = await Promise.all([
        prisma.process.findMany({
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
            caseId: true,
          },
          take: limit,
        }),
        prisma.case.findMany({
          where: {
            workspaceId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { processNumber: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, title: true, status: true, processNumber: true },
          take: limit,
        }),
      ]);
      return { processes, pieces, docs, cases };
    })(),
    (async () => {
      if (!wantLegal) return [];
      try {
        return await legalHitsFromDeepSeek(q, workspaceId);
      } catch (e) {
        log.warn("DeepSeek research failed (non-fatal)", { requestId, err: String(e) });
        return [];
      }
    })(),
  ]);

  const { processes, pieces, docs, cases } = workspaceResults;

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

  hits.push(...legalHits);

  return withRequestId(
    NextResponse.json({
      hits: hits.slice(0, limit),
      hadOfficialCorpus: legalHits.length > 0,
      scope,
      query: q,
      corpusSearchConfigMuted: isAnyCorpusSearchConfigMuted(),
    }),
    requestId,
  );
}
