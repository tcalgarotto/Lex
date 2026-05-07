/**
 * Research Engine — agrupa retrieval em teses dominantes, extrai divergências,
 * precedentes líderes e um texto consolidado determinístico.
 */

import { NormKind } from "@prisma/client";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalRetrievalFilters } from "@/lib/retrieval/legal/types";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import type {
  ConsolidatedUnderstanding,
  DominantThesisGroup,
  JurisprudentialDivergence,
  LeadingPrecedent,
  ResearchEngineReport,
} from "./types";

const SUMULA_KINDS: NormKind[] = [
  NormKind.SUMULA_STF,
  NormKind.SUMULA_STJ,
  NormKind.SUMULA_VINCULANTE,
];

function isJurisprudenceKind(k: NormKind): boolean {
  return k.toString().startsWith("JURISPRUDENCE") || SUMULA_KINDS.includes(k);
}

function trimExcerpt(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Constrói o relatório completo a partir dos chunks já ranqueados pelo retrieval.
 */
export function buildResearchReport(args: {
  chunks: LegalRetrievedChunk[];
  filters: LegalRetrievalFilters;
  contradictions: ContradictionRisk[];
}): ResearchEngineReport {
  const thesisGroups = groupDominantTheses(args.chunks);
  const divergences = buildDivergences(args.contradictions, args.chunks);
  const leading = pickLeadingPrecedents(args.chunks);
  const consolidated = buildConsolidated(thesisGroups, divergences, leading);

  return {
    filtersApplied: args.filters,
    thesisGroups,
    divergences,
    leadingPrecedents: leading,
    consolidated,
    ranking: {
      primarySignal: "hybrid_rrf_rerank_boost",
      chunkOrderStable: true,
    },
  };
}

export function groupDominantTheses(chunks: LegalRetrievedChunk[]): DominantThesisGroup[] {
  const byUrn = new Map<string, LegalRetrievedChunk[]>();
  for (const c of chunks) {
    const list = byUrn.get(c.norm.urn) ?? [];
    list.push(c);
    byUrn.set(c.norm.urn, list);
  }

  const groups: DominantThesisGroup[] = [];
  for (const [urn, groupChunks] of byUrn) {
    const sorted = [...groupChunks].sort((a, b) => b.scores.final - a.scores.final);
    const top = sorted[0]!;
    const scores = sorted.map((x) => x.scores.final);
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const tribunals = Array.from(
      new Set(sorted.map((x) => x.norm.tribunal).filter((t): t is string => !!t)),
    );
    groups.push({
      id: `thesis-${hashShort(urn).toString(36)}`,
      anchorUrn: urn,
      title: top.norm.title,
      identifier: top.norm.identifier,
      kind: top.norm.kind,
      dominantScore: top.scores.final,
      meanScore,
      chunkIds: sorted.map((x) => x.chunkId),
      tribunals,
      leadExcerpt: trimExcerpt(top.text),
    });
  }

  groups.sort((a, b) => b.dominantScore - a.dominantScore);
  return groups;
}

function hashShort(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function buildDivergences(
  contradictions: ContradictionRisk[],
  chunks: LegalRetrievedChunk[],
): JurisprudentialDivergence[] {
  const out: JurisprudentialDivergence[] = [];

  for (const r of contradictions) {
    const lc = `${r.title} ${r.detail}`.toLowerCase();
    if (/diverg|conflit|contradit|teses?\s+diferentes/i.test(lc)) {
      out.push({
        id: `div-contra-${r.id}`,
        summary: r.title,
        detail: r.detail,
        severity: r.severity,
        tribunalsInvolved: extractTribunalsFromEvidence(r.evidence.normUrns, chunks),
        evidenceChunkIds: r.evidence.chunkIds,
        source: "contradiction_layer",
      });
    }
  }

  const heuristic = crossTribunalHeuristic(chunks);
  out.push(...heuristic);

  const seen = new Set<string>();
  return out.filter((d) => {
    const key = `${d.summary}|${d.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTribunalsFromEvidence(
  urns: string[],
  chunks: LegalRetrievedChunk[],
): string[] {
  const set = new Set<string>();
  for (const c of chunks) {
    if (urns.includes(c.norm.urn) && c.norm.tribunal) set.add(c.norm.tribunal);
  }
  return [...set];
}

/**
 * Heurística leve: se há chunks de tribunais superiores distintos com mesmo articleRef,
 * sinaliza possível divergência regional/sistemática.
 */
export function crossTribunalHeuristic(chunks: LegalRetrievedChunk[]): JurisprudentialDivergence[] {
  const byArticle = new Map<string, LegalRetrievedChunk[]>();
  for (const c of chunks) {
    if (!c.articleRef) continue;
    const k = c.articleRef.trim().toLowerCase();
    const list = byArticle.get(k) ?? [];
    list.push(c);
    byArticle.set(k, list);
  }

  const out: JurisprudentialDivergence[] = [];
  for (const [, group] of byArticle) {
    const tribunals = new Set(group.map((g) => g.norm.tribunal).filter(Boolean) as string[]);
    if (tribunals.size < 2) continue;
    const superiors = [...tribunals].filter((t) =>
      /^(STF|STJ|TST|TSE|STM)$/i.test(t),
    );
    if (superiors.length >= 2) {
      const first = group[0]!;
      out.push({
        id: `div-heur-${first.articleRef}-${hashShort(superiors.join(","))}`,
        summary: `Mesmo dispositivo (${first.articleRef}) citado por ${superiors.join(" e ")}`,
        detail:
          "Recuperamos trechos de mais de um tribunal superior sobre o mesmo artigo — verifique convergência doutrinária e atualização.",
        severity: "media",
        tribunalsInvolved: superiors,
        evidenceChunkIds: group.map((g) => g.chunkId),
        source: "cross_tribunal_heuristic",
      });
    }
  }
  return out;
}

export function pickLeadingPrecedents(
  chunks: LegalRetrievedChunk[],
  limit = 8,
): LeadingPrecedent[] {
  const juris = chunks.filter((c) => isJurisprudenceKind(c.norm.kind));
  const pool = juris.length ? juris : chunks;
  const sorted = [...pool].sort((a, b) => b.scores.final - a.scores.final);
  return sorted.slice(0, limit).map((c, i) => ({
    chunkId: c.chunkId,
    rank: i + 1,
    urn: c.norm.urn,
    tribunal: c.norm.tribunal,
    score: c.scores.final,
    excerpt: trimExcerpt(c.text),
    articleRef: c.articleRef,
  }));
}

export function buildConsolidated(
  groups: DominantThesisGroup[],
  divergences: JurisprudentialDivergence[],
  leaders: LeadingPrecedent[],
): ConsolidatedUnderstanding {
  const top = groups[0];
  const headline = top
    ? `Recuperação ancora-se principalmente em ${top.identifier ?? top.title} (${top.anchorUrn}).`
    : "Nenhuma linha normativa dominante identificada nos resultados.";

  const paragraphs: string[] = [];
  if (groups.length > 1) {
    paragraphs.push(
      `Foram agrupadas ${groups.length} teses / linhas normativas distintas; a ordenação reflete o score contextual pós-rerank e boosts.`,
    );
  }
  if (divergences.length > 0) {
    paragraphs.push(
      `${divergences.length} sinal(is) de divergência ou tensão entre fontes — revisar antes de conclusões definitivas.`,
    );
  }
  if (leaders.length > 0 && leaders[0]) {
    paragraphs.push(
      `Precedente líder #1: ${leaders[0].tribunal ?? "órgão não informado"} · score ${leaders[0].score.toFixed(3)}.`,
    );
  }

  return {
    headline,
    paragraphs,
    thesisCount: groups.length,
    divergenceCount: divergences.length,
    leadingPrecedentCount: leaders.length,
  };
}
