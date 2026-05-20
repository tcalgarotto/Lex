import type { DeepseekStructureResponse } from "./structured-output-schema";

/** Evita usar resumo que é cópia quase literal do relato bruto. */
export function sanitizeStructuredSummary(
  summary: string,
  narrative: string,
  fallback: string,
): string {
  const s = summary.trim();
  const n = narrative.trim();
  if (s.length < 40 || n.length < 40) return s || fallback;

  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();

  const ns = norm(s);
  const nnFull = norm(n);
  const nn = nnFull.slice(0, Math.min(nnFull.length, ns.length + 80));
  if (ns.length > nn.length * 0.85 && nn.includes(ns.slice(0, Math.min(ns.length, 120)))) {
    return fallback;
  }
  return s;
}

export function mergeInformationGaps(structured: DeepseekStructureResponse): string[] {
  return Array.from(
    new Set(
      [...structured.information_gaps, ...structured.missing_questions]
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ).slice(0, 32);
}
