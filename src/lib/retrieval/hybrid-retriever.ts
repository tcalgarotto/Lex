import type { LegalLayer } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { legalSourceProductionRawSql } from "@/lib/corpus/source-visibility";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";
import { embedQuery } from "@/lib/ai/embeddings";
import { expandQuery } from "@/lib/ai/llm";
import { rerankDocuments } from "@/lib/ai/reranker";
import { reciprocalRankFusion } from "@/lib/retrieval/rrf";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { sha256Hex } from "@/lib/util/content-hash";
import { getHotContextChunks } from "@/lib/memory/hot-cache";
import { recordObservabilityLog } from "@/lib/observability/record";
import type { RetrievedChunk } from "@/lib/retrieval/types";
import type { SourceType } from "@/lib/retrieval/types";

export type { RetrievedChunk } from "@/lib/retrieval/types";

const DEFAULT_LAYERS: LegalLayer[] = [
  "legislation",
  "jurisprudence",
  "user_documents",
  "legal_pieces",
  "process_memory",
  "style_examples",
];

function vecDedupKey(payload: { contentHash?: string; chunkText: string }): string {
  return payload.contentHash ?? sha256Hex(payload.chunkText.slice(0, 1200));
}

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

export async function retrieveContext(params: {
  workspaceId: string;
  processId?: string;
  query: string;
  limit?: number;
  userId?: string;
}): Promise<{ chunks: RetrievedChunk[]; expandedQuery: string }> {
  const limit = params.limit ?? 10;
  const store = getQdrantVectorStore();
  const t0 = Date.now();

  let expanded = params.query;
  try {
    const tExp = Date.now();
    expanded = await expandQuery(params.query);
    recordObservabilityLog({
      workspaceId: params.workspaceId,
      userId: params.userId,
      kind: "llm.expand_query",
      name: "expand_query",
      latencyMs: Date.now() - tExp,
      payloadJson: { queryLen: params.query.length },
    });
  } catch {
    expanded = params.query;
  }

  const hot = await getHotContextChunks(params.workspaceId, params.processId);

  const vector = await embedQuery(expanded);
  const rawVecHits = await store.search({
    vector,
    workspaceIds: [params.workspaceId, GLOBAL_WORKSPACE_ID],
    layers: DEFAULT_LAYERS,
    limit: 48,
  });

  const seenVec = new Set<string>();
  const vecHits = rawVecHits.filter((h) => {
    const k = vecDedupKey(h.payload);
    if (seenVec.has(k)) return false;
    seenVec.add(k);
    return true;
  });

  const vecRanked = vecHits.map((h, i) => ({
    id: `vec:${h.id}`,
    rank: i,
    score: h.score,
    text: h.payload.chunkText,
    payload: h.payload,
  }));

  const pattern = `%${expanded.replace(/%/g, "")}%`;

  const processRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Process"
    WHERE "workspaceId" = ${params.workspaceId}
    AND (
      title ILIKE ${pattern}
      OR number ILIKE ${pattern}
      OR COALESCE(observations, '') ILIKE ${pattern}
    )
    LIMIT 12
  `;

  const chunkRows = await prisma.$queryRaw<Array<{ id: string; text: string }>>`
    SELECT c.id, c."textPreview" as text
    FROM "DocumentChunk" c
    INNER JOIN "Document" d ON d.id = c."documentId"
    WHERE d."workspaceId" = ${params.workspaceId}
    AND c."textPreview" ILIKE ${pattern}
    LIMIT 12
  `;

  const pieceRows = await prisma.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT id, title FROM "LegalPiece"
    WHERE "workspaceId" = ${params.workspaceId}
    AND title ILIKE ${pattern}
    LIMIT 8
  `;

  // LegalSource é a tabela legacy. Em produção filtramos DEMO/FIXTURE/etc.
  // via helper canônico em `lib/corpus/source-visibility.ts`. Selecionamos
  // APENAS as colunas usadas (sem ementa) para evitar overfetch.
  const isProd = process.env["NODE_ENV"] === "production";
  const legalRows = isProd
    ? await prisma.$queryRaw<Array<{ id: string; body: string; code: string }>>(Prisma.sql`
        SELECT id, body, code FROM "LegalSource"
        WHERE (body ILIKE ${pattern} OR code ILIKE ${pattern})
          AND ${legalSourceProductionRawSql()}
        LIMIT 12
      `)
    : await prisma.$queryRaw<Array<{ id: string; body: string; code: string }>>`
        SELECT id, body, code FROM "LegalSource"
        WHERE body ILIKE ${pattern} OR code ILIKE ${pattern}
        LIMIT 12
      `;

  const lexLists: Array<Array<{ id: string }>> = [
    processRows.map((r) => ({ id: `lex:proc:${r.id}` })),
    chunkRows.map((r) => ({ id: `lex:chunk:${r.id}` })),
    pieceRows.map((r) => ({ id: `lex:piece:${r.id}` })),
    legalRows.map((r) => ({ id: `lex:legal:${r.id}` })),
  ];

  const vecList = vecRanked.map((v) => ({ id: v.id }));
  const rrf = reciprocalRankFusion([vecList, ...lexLists], 60);

  const mergedIds = [...rrf.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([id]) => id);

  const docsForRerank: Array<{ id: string; text: string; chunk: RetrievedChunk }> = [];

  const sourceTypeFromLayer = (layer: LegalLayer): SourceType => {
    if (layer === "user_documents") return "process_document";
    if (layer === "legislation") return "legislation";
    if (layer === "jurisprudence") return "jurisprudence";
    if (layer === "process_memory") return "process_memory";
    if (layer === "legal_pieces") return "legal_piece";
    if (layer === "style_examples") return "style_example";
    return "unknown";
  };

  for (const mid of mergedIds) {
    if (mid.startsWith("vec:")) {
      const hit = vecRanked.find((v) => v.id === mid);
      if (!hit) continue;
      const p = hit.payload;
      const layer = p.layer;
      docsForRerank.push({
        id: mid,
        text: hit.text,
        chunk: {
          id: mid,
          text: hit.text,
          layer,
          sourceType: sourceTypeFromLayer(layer),
          sourceLabel: formatVectorLabel(p),
          score: typeof hit.score === "number" ? hit.score : null,
          meta: {
            workspaceId: p.workspaceId,
            documentId: p.documentId,
            processId: p.processId,
            articleRef: p.articleRef,
            tribunal: p.tribunal,
            sourceCode: p.sourceCode,
            section: p.section ? String(p.section) : undefined,
            contentHash: p.contentHash,
          },
        },
      });
      continue;
    }
    if (mid.startsWith("lex:proc:")) {
      const id = mid.replace("lex:proc:", "");
      const proc = await prisma.process.findFirst({
        where: { id, workspaceId: params.workspaceId },
      });
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
      const piece = await prisma.legalPiece.findFirst({
        where: { id, workspaceId: params.workspaceId },
      });
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
    } else if (mid.startsWith("lex:legal:")) {
      const id = mid.replace("lex:legal:", "");
      const src = await prisma.legalSource.findFirst({ where: { id } });
      if (!src) continue;
      docsForRerank.push({
        id: mid,
        text: src.body.slice(0, 4000),
        chunk: {
          id: mid,
          text: src.body.slice(0, 4000),
          layer: src.layer,
          sourceType: sourceTypeFromLayer(src.layer),
          sourceLabel: `${src.code} ${src.articleRef ?? ""}`.trim(),
          score: null,
          meta: { code: src.code, tribunal: src.tribunal ?? undefined },
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
    name: "rrf_rerank",
    latencyMs: Date.now() - t0,
    payloadJson: {
      vecHits: vecHits.length,
      expandedLen: expanded.length,
      hotCount: hot.length,
    },
    retrievalChunkIds: chunks.map((c) => c.id),
  });

  return { chunks, expandedQuery: expanded };
}

function formatVectorLabel(p: {
  layer: LegalLayer;
  sourceCode?: string;
  articleRef?: string;
  tribunal?: string;
}): string {
  if (p.layer === "legislation") return `${p.sourceCode ?? "Legislação"} ${p.articleRef ?? ""}`.trim();
  if (p.layer === "jurisprudence") return `${p.tribunal ?? "Jurisprudência"} ${p.sourceCode ?? ""}`.trim();
  return p.layer;
}
