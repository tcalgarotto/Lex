import type { RetrievedChunk } from "@/lib/retrieval/types";
import type { QueryClassification } from "@/lib/legal/query-classifier";
import type { SourceSufficiencyResult } from "@/lib/legal/source-sufficiency";

export type ConfidenceResult = {
  label: "Alta" | "Média" | "Baixa";
  score: number; // 0..1
  justification: string;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function computeConfidence(params: {
  classification: QueryClassification;
  retrievedChunks: RetrievedChunk[];
  sourceSufficiency: SourceSufficiencyResult;
}): ConfidenceResult {
  const { retrievedChunks, sourceSufficiency, classification } = params;

  if (!sourceSufficiency.sufficient) {
    return {
      label: "Baixa",
      score: 0.15,
      justification:
        sourceSufficiency.reasons[0] ??
        "Base insuficiente na indexação para concluir com segurança.",
    };
  }

  const types = new Set(retrievedChunks.map((c) => c.sourceType));
  const diversity = types.size;
  const hasProcessDoc = types.has("process_document");
  const hasLaw = types.has("legislation");
  const hasJuris = types.has("jurisprudence");
  const onlyMemory =
    retrievedChunks.length > 0 &&
    types.size === 1 &&
    types.has("process_memory");

  const scored = retrievedChunks.map((c) => c.score).filter((s): s is number => typeof s === "number");
  const avgScore = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0.72;

  let score =
    0.25 +
    0.18 * Math.min(1, diversity / 3) +
    (hasProcessDoc ? 0.22 : 0) +
    (hasLaw ? 0.15 : 0) +
    (hasJuris ? 0.12 : 0) +
    0.08 * clamp01((avgScore - 0.6) / 0.4);

  if (onlyMemory) score -= 0.25;
  if (sourceSufficiency.level === "medium") score -= 0.12;
  if (classification.requiresStrongSources && !hasProcessDoc && !hasLaw && !hasJuris) score -= 0.18;

  score = clamp01(score);

  let label: ConfidenceResult["label"] = "Média";
  if (score >= 0.72) label = "Alta";
  else if (score < 0.45) label = "Baixa";

  const bits: string[] = [];
  if (hasProcessDoc) bits.push("documento do processo");
  if (hasLaw) bits.push("legislação");
  if (hasJuris) bits.push("jurisprudência");
  if (!bits.length) bits.push("fontes limitadas");

  const justification = `${bits.join(" + ")}; ${retrievedChunks.length} fonte(s) considerada(s); suficiência ${sourceSufficiency.level}.`;

  return { label, score, justification };
}

