/**
 * Tipos do Research Engine — síntese jurisprudencial auditável sobre o resultado
 * do retrieval enterprise (não substitui o retrieval; interpreta os chunks).
 */

import type { LegalRetrievalFilters } from "@/lib/retrieval/legal/types";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";

/** Agrupamento por linha normativa / precedente dominante. */
export type DominantThesisGroup = {
  id: string;
  /** URN da norma âncora do grupo. */
  anchorUrn: string;
  title: string;
  identifier: string | null;
  kind: string;
  /** Score máximo entre chunks do grupo (ranking contextual interno). */
  dominantScore: number;
  /** Média dos scores finais (estabilidade do grupo). */
  meanScore: number;
  chunkIds: string[];
  tribunals: string[];
  /** Trecho representativo (chunk top do grupo). */
  leadExcerpt: string;
};

/** Par de tribunais / teses com sinal de divergência. */
export type JurisprudentialDivergence = {
  id: string;
  summary: string;
  detail: string;
  severity: ContradictionRisk["severity"];
  tribunalsInvolved: string[];
  evidenceChunkIds: string[];
  source: "contradiction_layer" | "cross_tribunal_heuristic";
};

/** Precedente “líder”: alto score + jurisprudência explícita. */
export type LeadingPrecedent = {
  chunkId: string;
  rank: number;
  urn: string;
  tribunal: string | null;
  score: number;
  excerpt: string;
  articleRef: string | null;
};

export type ResearchRankingMeta = {
  /** Critério principal após fusão híbrida + boosts (herdado do retrieval). */
  primarySignal: "hybrid_rrf_rerank_boost";
  chunkOrderStable: boolean;
};

export type ConsolidatedUnderstanding = {
  headline: string;
  paragraphs: string[];
  thesisCount: number;
  divergenceCount: number;
  leadingPrecedentCount: number;
};

export type ResearchEngineReport = {
  filtersApplied: LegalRetrievalFilters;
  thesisGroups: DominantThesisGroup[];
  divergences: JurisprudentialDivergence[];
  leadingPrecedents: LeadingPrecedent[];
  consolidated: ConsolidatedUnderstanding;
  ranking: ResearchRankingMeta;
};
