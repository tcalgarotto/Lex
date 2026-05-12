import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { expandQuery } from "@/lib/ai/llm";
import { rerankDocuments } from "@/lib/ai/reranker";
import { reciprocalRankFusion } from "@/lib/retrieval/rrf";
import { sha256Hex } from "@/lib/util/content-hash";
import { getHotContextChunks } from "@/lib/memory/hot-cache";
import { recordObservabilityLog } from "@/lib/observability/record";
import type { RetrievedChunk } from "@/lib/retrieval/types";
import { getPlatformLibraryWorkspaceId } from "@/lib/biblioteca/platform-library";

export type { RetrievedChunk } from "@/lib/retrieval/types";

function mergeHotAndDedupe(hot: RetrievedChunk[], ranked: RetrievedChunk[], limit: number): RetrievedChunk[] {
  const merged = [...hot, ...ranked];
  const out: RetrievedChunk[] = [];
  const seen = new Set<string>();
  for (const c of merged) {
    const k = sha256Hex(c.text.slice(0, 1000));
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Contexto híbrido leve: hot cache + expansão de query + busca lexical (Postgres)
 * + rerank — sem embeddings nem Qdrant.
 */
export async function retrieveContext(params: {
  workspaceId: string;
  processId?: string;
  query: string;
  limit?: number;
  userId?: string;
}): Promise<{ chunks: RetrievedChunk[]; expandedQuery: string }> {
  const limit = params.limit ?? 10;
  const t0 = Date.now();

  const [expanded, hot] = await Promise.all([
    (async () => {
      try {
        const tExp = Date.now();
        const res = await expandQuery(params.query);
        recordObservabilityLog({
          workspaceId: params.workspaceId,
          userId: params.userId,
          kind: "llm.expand_query",
          name: "expand_query",
          latencyMs: Date.now() - tExp,
          payloadJson: { queryLen: params.query.length },
        });
        return res;
      } catch {
        return params.query;
      }
    })(),
    getHotContextChunks(params.workspaceId, params.processId),
  ]);

  const pattern = `%${expanded.replace(/%/g, "")}%`;
  const platformId = await getPlatformLibraryWorkspaceId();
  const docWorkspaceIds = [...new Set([params.workspaceId, ...(platformId ? [platformId] : [])])];

  const [processRows, chunkRows, pieceRows] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Process"
      WHERE "workspaceId" = ${params.workspaceId}
      AND (
        title ILIKE ${pattern}
        OR number ILIKE ${pattern}
        OR COALESCE(observations, '') ILIKE ${pattern}
      )
      LIMIT 12
    `,
    prisma.$queryRaw<Array<{ id: string; text: string }>>`
      SELECT c.id, c."textPreview" as text
      FROM "DocumentChunk" c
      INNER JOIN "Document" d ON d.id = c."documentId"
      WHERE d."workspaceId" IN (${Prisma.join(docWorkspaceIds)})
      AND c."textPreview" ILIKE ${pattern}
      LIMIT 12
    `,
    prisma.$queryRaw<Array<{ id: string; title: string }>>`
      SELECT id, title FROM "LegalPiece"
      WHERE "workspaceId" = ${params.workspaceId}
      AND title ILIKE ${pattern}
      LIMIT 8
    `,
  ]);

  const lexLists: Array<Array<{ id: string }>> = [
    processRows.map((r) => ({ id: `lex:proc:${r.id}` })),
    chunkRows.map((r) => ({ id: `lex:chunk:${r.id}` })),
    pieceRows.map((r) => ({ id: `lex:piece:${r.id}` })),
  ];

  const rrf = reciprocalRankFusion(lexLists, 60);
  const mergedIds = [...rrf.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([id]) => id);

  const procIds = mergedIds
    .filter((id) => id.startsWith("lex:proc:"))
    .map((id) => id.replace("lex:proc:", ""));
  const pieceIds = mergedIds
    .filter((id) => id.startsWith("lex:piece:"))
    .map((id) => id.replace("lex:piece:", ""));

  const [fullProcs, fullPieces] = await Promise.all([
    procIds.length > 0
      ? prisma.process.findMany({
          where: { id: { in: procIds }, workspaceId: params.workspaceId },
          select: { id: true, title: true, number: true, observations: true },
        })
      : Promise.resolve([]),
    pieceIds.length > 0
      ? prisma.legalPiece.findMany({
          where: { id: { in: pieceIds }, workspaceId: params.workspaceId },
          select: { id: true, title: true, contentJson: true },
        })
      : Promise.resolve([]),
  ]);

  const procMap = new Map(fullProcs.map((p) => [p.id, p]));
  const pieceMap = new Map(fullPieces.map((p) => [p.id, p]));

  const docsForRerank: Array<{ id: string; text: string; chunk: RetrievedChunk }> = [];

  for (const mid of mergedIds) {
    if (mid.startsWith("lex:proc:")) {
      const id = mid.replace("lex:proc:", "");
      const proc = procMap.get(id);
      if (!proc) continue;
      const text = `${proc.title ?? ""} ${proc.number} ${proc.observations ?? ""}`.trim();
      docsForRerank.push({
        id: mid,
        text,
        chunk: {
          id: mid,
          text,
          layer: "process_memory",
          sourceType: "process_memory",
          sourceLabel: `Processo ${proc.number}`,
          score: null,
          meta: { processId: proc.id },
        },
      });
    } else if (mid.startsWith("lex:chunk:")) {
      const id = mid.replace("lex:chunk:", "");
      const row = chunkRows.find((c) => c.id === id);
      if (!row) continue;
      docsForRerank.push({
        id: mid,
        text: row.text,
        chunk: {
          id: mid,
          text: row.text,
          layer: "user_documents",
          sourceType: "process_document",
          sourceLabel: "Trecho de documento",
          score: null,
          meta: { chunkId: id },
        },
      });
    } else if (mid.startsWith("lex:piece:")) {
      const id = mid.replace("lex:piece:", "");
      const piece = pieceMap.get(id);
      if (!piece) continue;
      const text = `${piece.title} — ${JSON.stringify(piece.contentJson).slice(0, 2000)}`;
      docsForRerank.push({
        id: mid,
        text,
        chunk: {
          id: mid,
          text,
          layer: "legal_pieces",
          sourceType: "legal_piece",
          sourceLabel: piece.title,
          score: null,
          meta: { pieceId: piece.id },
        },
      });
    }
  }

  const reranked = await rerankDocuments(
    params.query,
    docsForRerank.map((d) => ({ id: d.id, text: d.text })),
    limit + hot.length,
  );

  const chunkById = new Map(docsForRerank.map((d) => [d.id, d.chunk]));
  const rankedChunks: RetrievedChunk[] = reranked
    .map((r) => chunkById.get(r.id))
    .filter((c): c is RetrievedChunk => Boolean(c));

  const chunks = mergeHotAndDedupe(hot, rankedChunks, limit);

  recordObservabilityLog({
    workspaceId: params.workspaceId,
    userId: params.userId,
    kind: "retrieval.hybrid",
    name: "lexical_rerank",
    latencyMs: Date.now() - t0,
    payloadJson: {
      lexicalCandidates: docsForRerank.length,
      expandedLen: expanded.length,
      hotCount: hot.length,
    },
    retrievalChunkIds: chunks.map((c) => c.id),
  });

  return { chunks, expandedQuery: expanded };
}
