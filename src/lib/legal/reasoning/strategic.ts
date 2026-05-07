/**
 * Strategic Legal Reasoning — heurísticas determinísticas sobre retrieval + caso.
 */

import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";
import type { LegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";

export type EvidenceGap = {
  id: string;
  /** Índice ou ordinal do fato quando disponível. */
  ordinal: number | null;
  preview: string;
  gapKind: "keyword_overlap_low" | "no_jurisprudence_anchor";
  suggestion: string;
};

export type TribunalFavorability = {
  targetTribunal: string | null;
  /** Fração de chunks cujo norm.tribunal coincide com o alvo (0..1). */
  alignmentScore: number;
  distribution: Array<{ tribunal: string | null; count: number; avgScore: number }>;
  verdict: "alinhado" | "misto" | "disperso";
};

export type ContradictionSeveritySummary = {
  alta: number;
  media: number;
  baixa: number;
};

export type StrategicLegalAssessment = {
  evidenceGaps: EvidenceGap[];
  tribunalFavorability: TribunalFavorability;
  riskHeuristics: Array<{ id: string; label: string; severity: "alta" | "media" | "baixa"; hint: string }>;
  proceduralNextSteps: string[];
  contradictionSeverity: ContradictionSeveritySummary;
  strategyBridge: string[];
};

function tokenizePt(text: string): Set<string> {
  const raw = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  return new Set(raw);
}

export function detectEvidenceGaps(args: {
  factTexts: string[];
  chunks: LegalRetrievedChunk[];
}): EvidenceGap[] {
  const corpusTokens = new Set<string>();
  for (const c of args.chunks) {
    for (const t of tokenizePt(c.text)) corpusTokens.add(t);
  }
  const out: EvidenceGap[] = [];
  args.factTexts.forEach((text, idx) => {
    const ftoks = tokenizePt(text);
    let overlap = 0;
    for (const t of ftoks) if (corpusTokens.has(t)) overlap += 1;
    const ratio = ftoks.size === 0 ? 0 : overlap / ftoks.size;
    if (ratio < 0.08 && ftoks.size >= 3) {
      out.push({
        id: `gap-${idx}`,
        ordinal: idx + 1,
        preview: text.slice(0, 120) + (text.length > 120 ? "…" : ""),
        gapKind: "keyword_overlap_low",
        suggestion:
          "Amplie a consulta ou reformule termos deste fato para recuperar fundamentação mais aderente.",
      });
    }
  });

  const hasJuris = args.chunks.some((c) => c.norm.kind.toString().includes("JURISPRUDENCE"));
  if (!hasJuris && args.chunks.length > 0) {
    out.push({
      id: "gap-juris-missing",
      ordinal: null,
      preview: "Conjunto atual é majoritariamente legislativo.",
      gapKind: "no_jurisprudence_anchor",
      suggestion: "Inclua tribunal alvo na pesquisa para trazer precedentes aplicáveis.",
    });
  }

  return out.slice(0, 12);
}

export function computeTribunalFavorability(args: {
  chunks: LegalRetrievedChunk[];
  targetTribunal: string | null;
}): TribunalFavorability {
  const dist = new Map<string | null, { count: number; scoreSum: number }>();
  for (const c of args.chunks) {
    const key = c.norm.tribunal;
    const row = dist.get(key) ?? { count: 0, scoreSum: 0 };
    row.count += 1;
    row.scoreSum += c.scores.final;
    dist.set(key, row);
  }

  const distribution = [...dist.entries()]
    .map(([tribunal, v]) => ({
      tribunal,
      count: v.count,
      avgScore: v.count === 0 ? 0 : v.scoreSum / v.count,
    }))
    .sort((a, b) => b.count - a.count);

  let alignmentScore = 0;
  if (args.targetTribunal && args.chunks.length > 0) {
    const tgt = args.targetTribunal.toUpperCase();
    let hit = 0;
    for (const c of args.chunks) {
      const tr = c.norm.tribunal?.toUpperCase();
      if (tr && (tr === tgt || tr.includes(tgt) || tgt.includes(tr))) hit += 1;
    }
    alignmentScore = hit / args.chunks.length;
  }

  let verdict: TribunalFavorability["verdict"] = "misto";
  if (alignmentScore >= 0.35) verdict = "alinhado";
  else if (alignmentScore < 0.12 && args.chunks.length > 3) verdict = "disperso";

  return {
    targetTribunal: args.targetTribunal,
    alignmentScore: Math.round(alignmentScore * 1000) / 1000,
    distribution,
    verdict,
  };
}

export function summarizeContradictionSeverity(risks: ContradictionRisk[]): ContradictionSeveritySummary {
  let alta = 0;
  let media = 0;
  let baixa = 0;
  for (const r of risks) {
    if (r.severity === "alta") alta += 1;
    else if (r.severity === "media") media += 1;
    else baixa += 1;
  }
  return { alta, media, baixa };
}

export function buildRiskHeuristics(args: {
  risks: ContradictionRisk[];
  issues: LegalIssue[];
  gaps: EvidenceGap[];
}): StrategicLegalAssessment["riskHeuristics"] {
  const out: StrategicLegalAssessment["riskHeuristics"] = [];

  for (const r of args.risks.slice(0, 8)) {
    out.push({
      id: `risk-${r.id}`,
      label: r.title,
      severity: r.severity,
      hint: r.detail.slice(0, 200),
    });
  }

  for (const i of args.issues.filter((x) => x.confidence >= 0.55).slice(0, 4)) {
    out.push({
      id: `issue-${i.id}`,
      label: i.title,
      severity: i.confidence >= 0.75 ? "alta" : "media",
      hint: i.rationale.slice(0, 200),
    });
  }

  if (args.gaps.length > 2) {
    out.push({
      id: "meta-gap-density",
      label: "Lacunas probatórias / fundamentação",
      severity: args.gaps.length > 5 ? "alta" : "media",
      hint: `${args.gaps.length} pontos com baixa aderência ao corpus recuperado.`,
    });
  }

  return out;
}

export function buildStrategicAssessment(args: {
  intent: LegalIntent;
  chunks: LegalRetrievedChunk[];
  risks: ContradictionRisk[];
  issues: LegalIssue[];
  strategy: StrategySynthesis;
  factTexts: string[];
  targetTribunal: string | null;
}): StrategicLegalAssessment {
  const evidenceGaps = detectEvidenceGaps({ factTexts: args.factTexts, chunks: args.chunks });
  const tribunalFavorability = computeTribunalFavorability({
    chunks: args.chunks,
    targetTribunal: args.targetTribunal ?? args.intent.tribunals[0] ?? null,
  });
  const contradictionSeverity = summarizeContradictionSeverity(args.risks);
  const riskHeuristics = buildRiskHeuristics({
    risks: args.risks,
    issues: args.issues,
    gaps: evidenceGaps,
  });

  const proceduralNextSteps = [...args.strategy.nextSteps];
  if (tribunalFavorability.verdict === "disperso") {
    proceduralNextSteps.unshift(
      `Restringir pesquisa ao tribunal ${tribunalFavorability.targetTribunal ?? "alvo"} para maior aderência.`,
    );
  }
  if (evidenceGaps.some((g) => g.gapKind === "keyword_overlap_low")) {
    proceduralNextSteps.push("Reforçar narração fática com termos de busca alinhados aos dispositivos recuperados.");
  }

  const strategyBridge = [
    args.strategy.thesis,
    ...args.strategy.arguments.slice(0, 2).map((a) => a.headline),
  ];

  return {
    evidenceGaps,
    tribunalFavorability,
    riskHeuristics,
    proceduralNextSteps: proceduralNextSteps.slice(0, 8),
    contradictionSeverity,
    strategyBridge,
  };
}
