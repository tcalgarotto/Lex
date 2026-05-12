import type { LegalRetrievalOptions, LegalRetrievedChunk } from "./types";

type PinnedChunkRow = {
  id: string;
  text: string;
  fullPath: string | null;
  structure: import("@prisma/client").LegalStructure;
  articleRef: string | null;
  normVersionId: string;
  version: { id: string; validFrom: Date; validTo: Date | null };
  norm: {
    id: string;
    urn: string;
    kind: import("@prisma/client").NormKind;
    jurisdiction: import("@prisma/client").NormJurisdiction;
    title: string;
    identifier: string | null;
    tribunal: string | null;
    publishedAt: Date | null;
  };
};

function toRetrievedChunk(
  r: PinnedChunkRow,
  origin: "pinned-chunk" | "pinned-norm",
): LegalRetrievedChunk {
  return {
    chunkId: r.id,
    text: r.text,
    fullPath: r.fullPath,
    structure: r.structure,
    articleRef: r.articleRef,
    norm: {
      id: r.norm.id,
      urn: r.norm.urn,
      kind: r.norm.kind,
      jurisdiction: r.norm.jurisdiction,
      title: r.norm.title,
      identifier: r.norm.identifier,
      tribunal: r.norm.tribunal,
      publishedAt: r.norm.publishedAt,
    },
    versionId: r.normVersionId,
    validFrom: r.version.validFrom,
    validTo: r.version.validTo,
    scores: { final: 1.0, rrf: 1.0 },
    provenance: [],
    explanation: `Pinned (${origin}) — incluído por mustInclude do caso.`,
  };
}

/**
 * F4 — Carrega chunks pinados que ainda não estejam no ranking final.
 */
export async function loadMustIncludeChunks(
  must: NonNullable<LegalRetrievalOptions["mustInclude"]>,
  already: LegalRetrievedChunk[],
): Promise<LegalRetrievedChunk[]> {
  const targetChunkIds = (must.chunkIds ?? []).filter(Boolean);
  const targetNormUrns = (must.normUrns ?? []).filter(Boolean);
  if (targetChunkIds.length === 0 && targetNormUrns.length === 0) return [];

  const alreadyChunkIds = new Set(already.map((c) => c.chunkId));
  const alreadyNormUrns = new Set(already.map((c) => c.norm.urn));

  const missingChunkIds = targetChunkIds.filter((id) => !alreadyChunkIds.has(id));
  const missingNormUrns = targetNormUrns.filter((u) => !alreadyNormUrns.has(u));
  if (missingChunkIds.length === 0 && missingNormUrns.length === 0) return [];

  const { prisma } = await import("@/lib/prisma");
  const out: LegalRetrievedChunk[] = [];

  const includeShape = {
    norm: {
      select: {
        id: true,
        urn: true,
        kind: true,
        jurisdiction: true,
        title: true,
        identifier: true,
        tribunal: true,
        publishedAt: true,
      },
    },
    version: {
      select: { id: true, validFrom: true, validTo: true },
    },
  } as const;

  if (missingChunkIds.length > 0) {
    const rows = await prisma.legalChunk.findMany({
      where: { id: { in: missingChunkIds } },
      include: includeShape,
    });
    for (const r of rows) {
      out.push(toRetrievedChunk(r, "pinned-chunk"));
    }
  }

  if (missingNormUrns.length > 0) {
    const rows = await prisma.legalChunk.findMany({
      where: {
        norm: { urn: { in: missingNormUrns } },
        version: { validTo: null },
      },
      include: includeShape,
      orderBy: [{ structure: "asc" }, { ordinal: "asc" }],
      take: missingNormUrns.length * 2,
    });
    const perUrn = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!perUrn.has(r.norm.urn)) perUrn.set(r.norm.urn, r);
    }
    for (const r of perUrn.values()) {
      out.push(toRetrievedChunk(r, "pinned-norm"));
    }
  }
  return out;
}
