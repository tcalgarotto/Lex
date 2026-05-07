/**
 * Expansão por 1-hop no grafo de citações.
 *
 * Premissa: se uma norma A foi recuperada e é altamente relevante, normas
 * que A cita (ou que citam A) provavelmente trazem contexto necessário.
 *
 * Estratégia (conservadora pra evitar drift):
 *  - Pega top-K (default 6) chunks já fundidos.
 *  - Coleta os normIds correspondentes.
 *  - Carrega arestas `LegalCitation` em ambos os sentidos.
 *  - Inclui apenas normas-alvo já existentes no banco (`targetNormId IS NOT NULL`).
 *  - Pra cada norma vizinha, pega o melhor chunk (PREAMBULO/EMENTA preferido,
 *    senão menor ordinal não-genérico) e adiciona como candidato com score
 *    proporcional ao rank de origem * 0.6 (decaimento).
 */

import { Prisma, type LegalStructure, type NormJurisdiction, type NormKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ChunkWithLineage,
  RetrievalCandidate,
  RetrievalProvenance,
} from "./types";

export type GraphExpansionResult = {
  added: ChunkWithLineage[];
  candidates: RetrievalCandidate[];
  /** Estatísticas pra trace. */
  stats: {
    seedNorms: number;
    edgesIn: number;
    edgesOut: number;
    addedChunks: number;
  };
};

/** Score atribuído a chunks adicionados via grafo (decaimento configurável). */
const GRAPH_BOOST_BASE = 0.45;
const GRAPH_RANK_DECAY = 0.85;

export async function expandViaGraph(args: {
  seeds: Array<{ chunkId: string; rrfScore: number }>;
  topSeeds?: number;
  maxAdded?: number;
  excludeChunkIds?: Set<string>;
}): Promise<GraphExpansionResult> {
  const topSeeds = args.topSeeds ?? 6;
  const maxAdded = args.maxAdded ?? 12;
  const seeds = args.seeds.slice(0, topSeeds);
  const excluded = args.excludeChunkIds ?? new Set<string>();

  if (seeds.length === 0) {
    return {
      added: [],
      candidates: [],
      stats: { seedNorms: 0, edgesIn: 0, edgesOut: 0, addedChunks: 0 },
    };
  }

  const seedChunks = await prisma.legalChunk.findMany({
    where: { id: { in: seeds.map((s) => s.chunkId) } },
    select: { id: true, normId: true },
  });
  const seedNormIds = Array.from(new Set(seedChunks.map((c) => c.normId)));
  if (seedNormIds.length === 0) {
    return {
      added: [],
      candidates: [],
      stats: { seedNorms: 0, edgesIn: 0, edgesOut: 0, addedChunks: 0 },
    };
  }

  // Citações OUT (norma seed cita X) e IN (X cita norma seed)
  const [edgesOut, edgesIn] = await Promise.all([
    prisma.legalCitation.findMany({
      where: { sourceNormId: { in: seedNormIds }, targetNormId: { not: null } },
      select: { sourceNormId: true, targetNormId: true, kind: true },
    }),
    prisma.legalCitation.findMany({
      where: { targetNormId: { in: seedNormIds } },
      select: { sourceNormId: true, targetNormId: true, kind: true },
    }),
  ]);

  // Mapa: normIdVizinha -> { provenance, seedNormId }
  type Visit = { provenance: RetrievalProvenance; seedNormId: string };
  const visits = new Map<string, Visit>();
  for (const e of edgesOut) {
    if (!e.targetNormId) continue;
    if (seedNormIds.includes(e.targetNormId)) continue;
    if (!visits.has(e.targetNormId)) {
      visits.set(e.targetNormId, {
        provenance: "graph_citation_out",
        seedNormId: e.sourceNormId,
      });
    }
  }
  for (const e of edgesIn) {
    if (seedNormIds.includes(e.sourceNormId)) continue;
    if (!visits.has(e.sourceNormId)) {
      visits.set(e.sourceNormId, {
        provenance: "graph_citation_in",
        seedNormId: e.targetNormId!,
      });
    }
  }

  const neighborIds = Array.from(visits.keys()).slice(0, maxAdded);
  if (neighborIds.length === 0) {
    return {
      added: [],
      candidates: [],
      stats: { seedNorms: seedNormIds.length, edgesIn: edgesIn.length, edgesOut: edgesOut.length, addedChunks: 0 },
    };
  }

  // Para cada norma vizinha, pega o melhor chunk: prefere ementa/preâmbulo,
  // senão o menor ordinal não-genérico.
  const rows = await prisma.$queryRaw<
    Array<{
      chunkId: string;
      text: string;
      fullPath: string | null;
      structure: LegalStructure;
      articleRef: string | null;
      contentHash: string;
      versionId: string;
      validFrom: Date;
      validTo: Date | null;
      normId: string;
      urn: string;
      kind: NormKind;
      jurisdiction: NormJurisdiction;
      title: string;
      identifier: string | null;
      tribunal: string | null;
      publishedAt: Date | null;
    }>
  >(Prisma.sql`
    SELECT DISTINCT ON (c."normId")
      c.id            AS "chunkId",
      c.text          AS "text",
      c."fullPath"    AS "fullPath",
      c.structure     AS "structure",
      c."articleRef"  AS "articleRef",
      c."contentHash" AS "contentHash",
      v.id            AS "versionId",
      v."validFrom"   AS "validFrom",
      v."validTo"     AS "validTo",
      n.id            AS "normId",
      n.urn           AS "urn",
      n.kind          AS "kind",
      n.jurisdiction  AS "jurisdiction",
      n.title         AS "title",
      n.identifier    AS "identifier",
      n.tribunal      AS "tribunal",
      n."publishedAt" AS "publishedAt"
    FROM "LegalChunk" c
    INNER JOIN "LegalNorm" n ON n.id = c."normId"
    INNER JOIN "LegalNormVersion" v ON v.id = c."normVersionId"
    WHERE c."normId" = ANY(${neighborIds})
      AND v."validTo" IS NULL
    ORDER BY
      c."normId",
      CASE c.structure
        WHEN 'EMENTA' THEN 0
        WHEN 'PREAMBULO' THEN 1
        ELSE 2
      END,
      c.ordinal ASC
  `);

  const added: ChunkWithLineage[] = [];
  const candidates: RetrievalCandidate[] = [];

  rows.forEach((r, i) => {
    if (excluded.has(r.chunkId)) return;
    const visit = visits.get(r.normId);
    if (!visit) return;

    const seed = seeds.find((s) =>
      seedChunks.some((sc) => sc.id === s.chunkId && sc.normId === visit.seedNormId),
    );
    const seedScore = seed?.rrfScore ?? 0.5;
    const score = GRAPH_BOOST_BASE * seedScore * Math.pow(GRAPH_RANK_DECAY, i);

    added.push({
      chunkId: r.chunkId,
      text: r.text,
      fullPath: r.fullPath,
      structure: r.structure,
      articleRef: r.articleRef,
      contentHash: r.contentHash,
      versionId: r.versionId,
      validFrom: r.validFrom,
      validTo: r.validTo,
      norm: {
        id: r.normId,
        urn: r.urn,
        kind: r.kind,
        jurisdiction: r.jurisdiction,
        title: r.title,
        identifier: r.identifier,
        tribunal: r.tribunal,
        publishedAt: r.publishedAt,
      },
    });
    candidates.push({
      chunkId: r.chunkId,
      rank: i,
      rawScore: score,
      source: visit.provenance,
    });
  });

  return {
    added,
    candidates,
    stats: {
      seedNorms: seedNormIds.length,
      edgesIn: edgesIn.length,
      edgesOut: edgesOut.length,
      addedChunks: added.length,
    },
  };
}
