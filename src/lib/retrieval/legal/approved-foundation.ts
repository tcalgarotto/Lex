import type { LegalRetrievedChunk, LegalRetrievalResult } from "./types";

export type FoundationAudience = "user" | "admin";

export type Lacuna = {
  kind: "MISSING_SOURCE" | "MISSING_EXCERPT" | "LOW_GROUNDING";
  message: string;
};

/**
 * F7.2 — Fundamento jurídico aprovado para consumo por drafting/review.
 * Regra: só pode ser derivado de chunks recuperados do corpus indexado.
 */
export type ApprovedLegalFoundation = {
  /** id do chunk no corpus (auditável). */
  chunkId: string;
  /** id da versão temporal da norma. */
  versionId: string;
  urn: string;
  title: string;
  identifier: string | null;
  kind: string;
  articleRef: string | null;
  fullPath: string | null;
  excerpt: string;
  reason: string;
  score: number;
  // campos extras apenas para admin/dev
  _meta?: {
    validFrom: string;
    validTo: string | null;
    scores: LegalRetrievedChunk["scores"];
    provenance: LegalRetrievedChunk["provenance"];
  };
};

export function validateLegalGrounding(result: LegalRetrievalResult): { ok: boolean; gaps: Lacuna[] } {
  const gaps: Lacuna[] = [];
  if (result.groundingScore < 0.25) {
    gaps.push({
      kind: "LOW_GROUNDING",
      message: "Grounding fraco: a base recuperada pode não ser suficiente para sustentar conclusões.",
    });
  }
  for (const c of result.chunks) {
    if (!c.norm?.urn) {
      gaps.push({ kind: "MISSING_SOURCE", message: "Chunk sem URN (fonte não auditável)." });
    }
    const txt = (c.text ?? "").trim();
    if (txt.length < 40) {
      gaps.push({ kind: "MISSING_EXCERPT", message: "Trecho curto demais para citação." });
    }
  }
  return { ok: gaps.length === 0, gaps };
}

export function buildApprovedLegalFoundation(args: {
  chunks: LegalRetrievedChunk[];
  audience: FoundationAudience;
  limit?: number;
}): ApprovedLegalFoundation[] {
  const limit = Math.max(1, Math.min(24, args.limit ?? 8));
  const out: ApprovedLegalFoundation[] = [];
  for (const c of args.chunks.slice(0, limit)) {
    const excerpt = (c.text ?? "").trim().slice(0, 900);
    if (!c.norm?.urn || excerpt.length < 40) continue;
    out.push({
      chunkId: c.chunkId,
      versionId: c.versionId,
      urn: c.norm.urn,
      title: c.norm.title,
      identifier: c.norm.identifier,
      kind: String(c.norm.kind),
      articleRef: c.articleRef,
      fullPath: c.fullPath,
      excerpt,
      reason: c.explanation,
      score: c.scores.final,
      ...(args.audience === "admin"
        ? {
            _meta: {
              validFrom: c.validFrom.toISOString(),
              validTo: c.validTo ? c.validTo.toISOString() : null,
              scores: c.scores,
              provenance: c.provenance,
            },
          }
        : {}),
    });
  }
  return out;
}

