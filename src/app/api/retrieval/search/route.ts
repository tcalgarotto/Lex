import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { buildCaseBrainFingerprint } from "@/lib/cases/brain-fingerprint";
import { buildRetrievalSearchCompatiblePayload } from "@/lib/legal-research/retrieval-adapter";
import { extractRelevantSnippet } from "@/lib/retrieval/legal/snippet";
import { getCorpusManifest } from "@/lib/corpus/manifest";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isAnyCorpusSearchConfigMuted } from "@/lib/retrieval/corpus-search-flags";

/**
 * Endpoint "amigável" da Pesquisa jurídica do usuário final.
 *
 * Camada legislação via pesquisa assistida (DeepSeek); demais camadas em
 * Postgres. Modo técnico de auditoria do motor de busca foi descontinuado nesta fase.
 */

const log = getLogger("lex.api.retrieval.search");

const LAYER_KEYS = [
  "legislacao",
  "escritorio",
  "fundamentos",
  "caso",
  "pecas",
  "jurisprudencia",
] as const;

type LayerKey = (typeof LAYER_KEYS)[number];

export async function GET(req: Request) {
  const requestId = randomUUID();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const topK = parseTopK(url.searchParams.get("topK"));
  const scope = url.searchParams.get("scope") ?? "tudo";
  const caseId = url.searchParams.get("caseId");
  const layers = parseLayers(url.searchParams.get("layers"));

  if (q.length < 2) {
    return withRequestId(
      NextResponse.json({
        query: q,
        results: [],
        libraryMatches: [],
        casePins: [],
        pieceMatches: [],
        pendingLayers: [],
        bases: await dynamicBases(),
        confidence: null,
        ranBy: "skip",
        layers: [...layers],
        corpusSearchConfigMuted: isAnyCorpusSearchConfigMuted(),
      }),
      requestId,
    );
  }

  let workspaceId: string;
  try {
    ({ workspaceId } = await getWorkspaceContext());
  } catch {
    return withRequestId(
      NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
      requestId,
    );
  }

  try {
    const wantLegislacao = layers.has("legislacao");
    const wantLibrary =
      layers.has("escritorio") || layers.has("fundamentos");
    const wantCaso = layers.has("caso") && Boolean(caseId);
    const wantPecas = layers.has("pecas");
    const wantJuris = layers.has("jurisprudencia");

    let caseBrainFingerprint: string | undefined;
    if (caseId) {
      const row = await prisma.case.findFirst({
        where: { workspaceId, id: caseId, deletedAt: null },
        select: { metadataJson: true, updatedAt: true },
      });
      if (row) {
        caseBrainFingerprint = buildCaseBrainFingerprint(row.metadataJson, row.updatedAt);
      }
    }

    const tSearch = Date.now();
    const corpusMuted = isAnyCorpusSearchConfigMuted();
    const [legislacaoPayload, libraryMatches, casePins, pieceMatches] = await Promise.all([
      wantLegislacao && !corpusMuted
        ? buildRetrievalSearchCompatiblePayload({
            workspaceId,
            query: q,
            topK,
            ...(caseId ? { caseId } : {}),
            ...(caseBrainFingerprint ? { caseBrain: caseBrainFingerprint } : {}),
          })
        : Promise.resolve(null),
      wantLibrary && q.length >= 2
        ? prisma.libraryFoundation.findMany({
            where: {
              workspaceId,
              deletedAt: null,
              archivedAt: null,
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { contentMd: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: 12,
            select: {
              id: true,
              title: true,
              tags: true,
              updatedAt: true,
              optInSearch: true,
              useAsModel: true,
              useAsStyle: true,
            },
          })
        : Promise.resolve([]),
      wantCaso && caseId
        ? prisma.caseLegalSource.findMany({
            where: { caseId, case: { workspaceId } },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              chunkId: true,
              normUrn: true,
              articleRef: true,
              excerpt: true,
              query: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      wantPecas && q.length >= 2
        ? prisma.legalPiece.findMany({
            where: {
              workspaceId,
              deletedAt: null,
              archivedAt: null,
              title: { contains: q, mode: "insensitive" },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
            select: { id: true, title: true, kind: true, updatedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const results =
      legislacaoPayload?.results.map((r) => ({
        ...r,
        snippet: extractRelevantSnippet(r.text, q, { maxChars: 320 }),
        excerpt: extractRelevantSnippet(r.excerpt || r.text, q, { maxChars: 320 }),
        score: roundScore(r.score),
      })) ?? [];

    const pendingLayers: string[] = [];
    if (wantJuris) pendingLayers.push("jurisprudencia");

    log.info("retrieval.search.ok", {
      event: "retrieval.search.ok",
      requestId,
      workspaceId,
      queryLen: q.length,
      layers: [...layers],
      counts: {
        legislacao: results.length,
        library: libraryMatches.length,
        casoPins: casePins.length,
        pecas: pieceMatches.length,
      },
      durationMs: Date.now() - tSearch,
    });

    return withRequestId(
      NextResponse.json({
        query: q,
        scope,
        caseId: caseId ?? null,
        layers: [...layers],
        results,
        libraryMatches: libraryMatches.map((f) => ({
          layer: "fundamentos" as const,
          id: f.id,
          title: f.title,
          tags: f.tags,
          updatedAt: f.updatedAt.toISOString(),
          optInSearch: f.optInSearch,
          useAsModel: f.useAsModel,
          useAsStyle: f.useAsStyle,
          href: `/biblioteca/fundamentos/${f.id}`,
          origin: "Biblioteca (workspace)",
          reason: "Texto salvo na biblioteca (não substitui norma indexada).",
        })),
        casePins: casePins.map((p) => ({
          layer: "caso" as const,
          id: p.id,
          chunkId: p.chunkId,
          articleRef: p.articleRef,
          normUrn: p.normUrn,
          excerpt: p.excerpt,
          query: p.query,
          createdAt: p.createdAt.toISOString(),
          origin: "Fundamentos fixados neste caso",
          reason: p.query ? `Salvo a partir da busca: ${p.query.slice(0, 80)}` : "Fixado manualmente",
        })),
        pieceMatches: pieceMatches.map((p) => ({
          layer: "pecas" as const,
          id: p.id,
          title: p.title,
          kind: p.kind,
          updatedAt: p.updatedAt.toISOString(),
          href: `/editor/${p.id}`,
          origin: "Peça do workspace",
          reason: "Título da peça contém o termo buscado.",
        })),
        pendingLayers,
        total: results.length,
        bases: await dynamicBases(),
        confidence: legislacaoPayload?.confidence ?? null,
        cached: legislacaoPayload?.cached ?? false,
        corpusSearchConfigMuted: corpusMuted,
      }),
      requestId,
    );
  } catch (err) {
    log.error("retrieval.search.error", {
      event: "retrieval.search.error",
      requestId,
      workspaceId,
      queryLen: q.length,
      err: err instanceof Error ? err.message : String(err),
    });
    return withRequestId(
      NextResponse.json({ error: "Não foi possível buscar agora." }, { status: 500 }),
      requestId,
    );
  }
}

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  return res;
}

function parseLayers(raw: string | null): Set<LayerKey> {
  const out = new Set<LayerKey>();
  if (!raw?.trim()) {
    for (const k of LAYER_KEYS) {
      if (k !== "jurisprudencia") out.add(k);
    }
    return out;
  }
  for (const part of raw.split(",")) {
    const p = part.trim().toLowerCase() as LayerKey;
    if (LAYER_KEYS.includes(p)) out.add(p);
  }
  if (out.size === 0) {
    for (const k of LAYER_KEYS) {
      if (k !== "jurisprudencia") out.add(k);
    }
  }
  return out;
}

function parseTopK(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return 8;
  return Math.min(20, Math.max(1, n));
}

function roundScore(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Base {
  key: string;
  label: string;
  available: boolean;
  hint?: string;
}

async function dynamicBases(): Promise<Base[]> {
  try {
    const manifest = await getCorpusManifest();
    const out: Base[] = [];
    for (const norm of manifest.availableNorms) {
      out.push({ key: norm.urn, label: norm.label, available: true });
    }
    for (const hint of manifest.unavailableHints) {
      out.push({
        key: hint.urnPattern,
        label: hint.label,
        available: false,
        hint: "Será indexado em ondas futuras",
      });
    }
    if (out.length > 0) return out;
  } catch {
    /* fallback abaixo */
  }
  return [
    { key: "cf", label: "Constituição Federal", available: true },
    { key: "adct", label: "ADCT", available: true },
    {
      key: "infra",
      label: "Legislação infraconstitucional",
      available: false,
      hint: "Em breve",
    },
    {
      key: "jurisprudencia",
      label: "Jurisprudência",
      available: false,
      hint: "Em breve",
    },
  ];
}
