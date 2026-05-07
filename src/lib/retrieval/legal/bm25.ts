/**
 * Sparse retrieval via Postgres full-text search (BM25-like).
 *
 * Usa a coluna gerada `LegalChunk.textTsv` (`tsvector` português) com índice
 * GIN. Ranking via `ts_rank_cd` (cover density). Filtros declarativos por
 * NormKind/Jurisdiction/Tribunal/temporal são aplicados no SQL.
 *
 * Por que SQL bruto e não Prisma where? Porque Prisma 6 ainda não expõe
 * tsquery operators tipados — usamos `$queryRaw` com `Prisma.sql` pra
 * compor com segurança.
 */

import { Prisma, type LegalStructure, type NormKind, type NormJurisdiction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toTsQueryString } from "./rewrite";
import type { ChunkWithLineage, LegalRetrievalFilters, RetrievalCandidate } from "./types";

export type Bm25Result = {
  chunk: ChunkWithLineage;
  rawScore: number;
};

const FTS_LANG = "portuguese";

/**
 * Busca BM25 com filtros aplicados na query.
 * Idempotente: mesma entrada → mesma saída (Postgres é determinístico).
 */
export async function searchBm25(args: {
  query: string;
  limit: number;
  filters?: LegalRetrievalFilters;
  includeGeneric?: boolean;
}): Promise<Bm25Result[]> {
  const sanitized = toTsQueryString(args.query);
  if (!sanitized) return [];

  const filters = args.filters ?? {};

  const conditions: Prisma.Sql[] = [
    Prisma.sql`c."textTsv" @@ websearch_to_tsquery(${FTS_LANG}::regconfig, ${sanitized})`,
  ];

  if (!args.includeGeneric) {
    conditions.push(Prisma.sql`c.structure NOT IN ('GENERIC')`);
  }
  if (filters.kinds?.length) {
    conditions.push(
      Prisma.sql`n.kind = ANY(${filters.kinds.map(String)}::"NormKind"[])`,
    );
  }
  if (filters.jurisdictions?.length) {
    conditions.push(
      Prisma.sql`n.jurisdiction = ANY(${filters.jurisdictions.map(String)}::"NormJurisdiction"[])`,
    );
  }
  if (filters.tribunals?.length) {
    conditions.push(Prisma.sql`n.tribunal = ANY(${filters.tribunals})`);
  }
  if (filters.normUrns?.length) {
    conditions.push(Prisma.sql`n.urn = ANY(${filters.normUrns})`);
  }
  if (filters.articleRefs?.length) {
    conditions.push(Prisma.sql`c."articleRef" = ANY(${filters.articleRefs})`);
  }
  if (filters.publishedAfter) {
    conditions.push(Prisma.sql`n."publishedAt" >= ${filters.publishedAfter}`);
  }
  if (filters.asOf) {
    // Apenas versões válidas naquela data.
    conditions.push(
      Prisma.sql`v."validFrom" <= ${filters.asOf} AND (v."validTo" IS NULL OR v."validTo" > ${filters.asOf})`,
    );
  }

  const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

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
      rawScore: number;
    }>
  >(Prisma.sql`
    SELECT
      c.id              AS "chunkId",
      c.text            AS "text",
      c."fullPath"      AS "fullPath",
      c.structure       AS "structure",
      c."articleRef"    AS "articleRef",
      c."contentHash"   AS "contentHash",
      v.id              AS "versionId",
      v."validFrom"     AS "validFrom",
      v."validTo"       AS "validTo",
      n.id              AS "normId",
      n.urn             AS "urn",
      n.kind            AS "kind",
      n.jurisdiction    AS "jurisdiction",
      n.title           AS "title",
      n.identifier      AS "identifier",
      n.tribunal        AS "tribunal",
      n."publishedAt"   AS "publishedAt",
      ts_rank_cd(c."textTsv", websearch_to_tsquery(${FTS_LANG}::regconfig, ${sanitized}))::float AS "rawScore"
    FROM "LegalChunk" c
    INNER JOIN "LegalNorm" n ON n.id = c."normId"
    INNER JOIN "LegalNormVersion" v ON v.id = c."normVersionId"
    ${where}
    ORDER BY "rawScore" DESC
    LIMIT ${args.limit}
  `);

  return rows.map((r) => ({
    rawScore: r.rawScore,
    chunk: {
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
    },
  }));
}

/** Converte resultado BM25 em `RetrievalCandidate` para a fusão RRF. */
export function bm25ToCandidates(results: Bm25Result[]): RetrievalCandidate[] {
  return results.map((r, i) => ({
    chunkId: r.chunk.chunkId,
    rank: i,
    rawScore: r.rawScore,
    source: "bm25" as const,
  }));
}
