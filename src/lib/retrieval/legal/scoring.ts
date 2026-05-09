/**
 * Scoring pós-rerank: boosts (hierarquia, recência, alinhamento de intent)
 * e cálculo do grounding/confidence finais.
 *
 * Determinístico, fácil de auditar. Cada boost tem nome legível pra log.
 */

import { NormKind, type LegalStructure } from "@prisma/client";
import type { LegalIntent } from "./intent";
import type {
  ChunkWithLineage,
  LegalRetrievedChunk,
  ScoreBreakdown,
} from "./types";
import { articleRefIncludes } from "./article-ref";

/** Boosts são multiplicativos sobre o rerank score (todos em [0..1]). */
const BOOSTS = {
  /** Súmula vinculante > súmula simples > acórdão > legislação > genérico. */
  kind: {
    [NormKind.SUMULA_VINCULANTE]: 1.18,
    [NormKind.SUMULA_STJ]: 1.12,
    [NormKind.SUMULA_STF]: 1.12,
    [NormKind.JURISPRUDENCE_STF]: 1.08,
    [NormKind.JURISPRUDENCE_STJ]: 1.08,
    [NormKind.CONSTITUTION]: 1.10,
    [NormKind.CONSTITUTIONAL_AMENDMENT]: 1.08,
    [NormKind.COMPLEMENTARY_LAW]: 1.05,
    [NormKind.ORDINARY_LAW]: 1.0,
  } as Partial<Record<NormKind, number>>,
  /** ARTIGO/CAPUT > PARAGRAFO > INCISO > GENERIC. */
  structure: {
    ARTIGO: 1.10,
    CAPUT: 1.08,
    PARAGRAFO: 1.05,
    INCISO: 1.02,
    EMENTA: 1.05,
    GENERIC: 0.85,
    PREAMBULO: 0.9,
  } as Partial<Record<LegalStructure, number>>,
};

const RECENCY_HALF_LIFE_DAYS = 365 * 4; // 4 anos.

function computeRecencyBoost(publishedAt: Date | null, asOf: Date): number {
  if (!publishedAt) return 1.0;
  const ageDays = Math.max(0, (asOf.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));
  // Boost ∈ [0.85, 1.0]: norma recente = 1.0; norma muito antiga = 0.85.
  const decay = 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS);
  return 0.85 + 0.15 * decay;
}

function computeIntentAlignmentBoost(
  chunk: ChunkWithLineage,
  intent: LegalIntent,
): number {
  let factor = 1.0;
  if (intent.urns.includes(chunk.norm.urn)) factor *= 1.20;
  if (intent.tribunals.length > 0 && chunk.norm.tribunal) {
    if (intent.tribunals.includes(chunk.norm.tribunal)) factor *= 1.10;
  }
  if (intent.preferredKinds.length > 0 && intent.preferredKinds.includes(chunk.norm.kind)) {
    factor *= 1.05;
  }
  if (
    intent.articleRefs.length > 0 &&
    chunk.articleRef &&
    articleRefIncludes(intent.articleRefs, chunk.articleRef)
  ) {
    factor *= 1.15; // exactArticleBoost
  }
  const sumulaKinds: NormKind[] = [
    NormKind.SUMULA_VINCULANTE,
    NormKind.SUMULA_STJ,
    NormKind.SUMULA_STF,
  ];
  if (intent.wantsSumula && sumulaKinds.includes(chunk.norm.kind)) {
    factor *= 1.08;
  }
  return Math.min(factor, 1.6);
}

/**
 * Penaliza chunks "longos genéricos" quando a query é claramente
 * específica (menciona inciso/§ via algarismos romanos ou parágrafo)
 * mas não cita um artigo. Evita que o "Art. 5º" inteiro vença um
 * inciso específico do mesmo artigo.
 */
function computeLongGenericPenalty(
  chunk: ChunkWithLineage,
  intent: LegalIntent,
  rawQuery: string | undefined,
): number {
  if (intent.articleRefs.length > 0) return 1.0;
  const hasIncisoOrParagraph =
    /\b[IVXLCDM]+\b/.test(rawQuery ?? "") || /§|par[áa]grafo|inciso/i.test(rawQuery ?? "");
  if (!hasIncisoOrParagraph) return 1.0;
  if (chunk.text.length > 1500 && chunk.structure !== "INCISO" && chunk.structure !== "PARAGRAFO") {
    return 0.85;
  }
  return 1.0;
}

function computeAdctPenalty(chunk: ChunkWithLineage, intent: LegalIntent, rawQuery?: string): number {
  const isAdct =
    chunk.norm.urn.includes("!adct") ||
    /\bADCT\b/i.test(chunk.norm.identifier ?? "") ||
    /\bADCT\b/i.test(chunk.norm.title);
  if (!isAdct) return 1.0;
  // Se o usuário pediu ADCT explicitamente, não penaliza.
  if (/\bADCT\b/i.test(rawQuery ?? "")) return 1.0;
  // Se intent cita artigo e o chunk é exatamente esse artigo, reduz penalidade.
  if (intent.articleRefs.length > 0 && chunk.articleRef) return 0.93;
  return 0.85;
}

function computeRevokedPenalty(chunk: ChunkWithLineage, asOf: Date): number {
  if (!chunk.validTo) return 1.0;
  if (asOf.getTime() <= chunk.validTo.getTime()) return 1.0;
  return 0.75;
}

/**
 * Aplica boosts compostos sobre `rerankScore` (0..1) e devolve o `final`.
 * Idempotente.
 */
export function computeFinalScore(args: {
  rerankScore?: number;
  rrfScore: number;
  rawScores: { dense?: number; bm25?: number };
  chunk: ChunkWithLineage;
  intent: LegalIntent;
  /** Query crua usada para detectar pedido de inciso/§ específico. */
  rawQuery?: string;
  /** Sinaliza quando veio de mustInclude/pinado. */
  pinned?: boolean;
  /** Contexto do caso (áreas) para boosts leves. */
  caseAreas?: string[];
}): { breakdown: ScoreBreakdown; explanation: string } {
  const base = args.rerankScore ?? args.rrfScore ?? 0;
  const boostKind = BOOSTS.kind[args.chunk.norm.kind] ?? 1.0;
  const boostStruct = BOOSTS.structure[args.chunk.structure] ?? 1.0;
  const asOf = args.intent.asOf ?? new Date();
  const boostRecency = computeRecencyBoost(args.chunk.norm.publishedAt, asOf);
  const boostIntent = computeIntentAlignmentBoost(args.chunk, args.intent);
  const longGenericPenalty = computeLongGenericPenalty(args.chunk, args.intent, args.rawQuery);
  const adctPenalty = computeAdctPenalty(args.chunk, args.intent, args.rawQuery);
  const revokedPenalty = computeRevokedPenalty(args.chunk, asOf);
  const pinnedBoost = args.pinned ? 1.25 : 1.0;
  const caseContextBoost =
    args.caseAreas && args.caseAreas.length > 0
      ? 1.0 + Math.min(0.06, args.caseAreas.length * 0.02)
      : 1.0;
  const topicBoost = caseContextBoost; // por enquanto, mesma heurística (explicável)

  const boostTotal =
    boostKind *
    boostStruct *
    boostRecency *
    boostIntent *
    longGenericPenalty *
    adctPenalty *
    revokedPenalty *
    pinnedBoost *
    topicBoost;

  const final = Math.min(1, base * boostTotal);

  const explanation = [
    args.chunk.norm.identifier ?? args.chunk.norm.title,
    args.chunk.fullPath,
    `[kind=${args.chunk.norm.kind}, struct=${args.chunk.structure}]`,
    args.rerankScore !== undefined ? `rerank=${args.rerankScore.toFixed(3)}` : `rrf=${args.rrfScore.toFixed(3)}`,
    `boost=${boostTotal.toFixed(2)} (kind×${boostKind.toFixed(2)} struct×${boostStruct.toFixed(2)} recency×${boostRecency.toFixed(2)} intent×${boostIntent.toFixed(2)}${longGenericPenalty < 1 ? ` longChunk×${longGenericPenalty.toFixed(2)}` : ""}${adctPenalty < 1 ? ` adct×${adctPenalty.toFixed(2)}` : ""}${revokedPenalty < 1 ? ` revoked×${revokedPenalty.toFixed(2)}` : ""}${pinnedBoost > 1 ? ` pinned×${pinnedBoost.toFixed(2)}` : ""}${topicBoost > 1 ? ` topic×${topicBoost.toFixed(2)}` : ""})`,
    `final=${final.toFixed(3)}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const breakdown: ScoreBreakdown = {
    rrf: args.rrfScore,
    boost: boostTotal,
    exactArticleBoost: args.intent.articleRefs.length > 0 && args.chunk.articleRef && articleRefIncludes(args.intent.articleRefs, args.chunk.articleRef) ? 1.15 : 1.0,
    topicBoost,
    caseContextBoost,
    pinnedBoost,
    longChunkPenalty: longGenericPenalty,
    adctPenalty,
    revokedPenalty,
    final,
  };
  if (args.rawScores.dense !== undefined) breakdown.dense = args.rawScores.dense;
  if (args.rawScores.bm25 !== undefined) breakdown.bm25 = args.rawScores.bm25;
  if (args.rerankScore !== undefined) breakdown.rerank = args.rerankScore;
  return { breakdown, explanation };
}

/** Calcula grounding score 0..1 a partir dos chunks finais. */
export function computeGroundingScore(args: {
  chunks: LegalRetrievedChunk[];
  intent: LegalIntent;
}): number {
  if (args.chunks.length === 0) return 0;

  const top1 = args.chunks[0]!.scores.final;
  const top3Avg =
    args.chunks.slice(0, 3).reduce((s, c) => s + c.scores.final, 0) /
    Math.min(3, args.chunks.length);

  const distinctNorms = new Set(args.chunks.map((c) => c.norm.urn)).size;
  const diversityBonus = Math.min(0.15, distinctNorms * 0.03);

  // Bônus quando há normas que o intent pediu explicitamente.
  let intentMatch = 0;
  if (args.intent.urns.length > 0) {
    const overlap = args.chunks.filter((c) => args.intent.urns.includes(c.norm.urn)).length;
    if (overlap > 0) intentMatch = 0.1;
  }

  const score = 0.45 * top1 + 0.35 * top3Avg + diversityBonus + intentMatch;
  return Math.min(1, Math.max(0, score));
}

/** Mapeia grounding em label de confidence. */
export function groundingToConfidence(grounding: number): {
  label: "Alta" | "Média" | "Baixa";
  score: number;
  reason: string;
} {
  if (grounding >= 0.7) {
    return { label: "Alta", score: grounding, reason: "Forte alinhamento entre query, fontes e grounding." };
  }
  if (grounding >= 0.45) {
    return { label: "Média", score: grounding, reason: "Fontes coerentes mas com sinais limitados." };
  }
  return { label: "Baixa", score: grounding, reason: "Recall fraco ou pouca diversidade de fontes." };
}
