/**
 * F4.1 — Drafting Guard contra citação de normas fora do corpus indexado.
 *
 * Lema: "se não está no manifest, não pode aparecer em VI. Fundamentação;
 * vai para VII. Lacunas de complementação".
 *
 * Quem usa: `renderLaw`, `renderUrgency`, `renderRequests` em `drafting.ts`.
 * Antes de gerar markdown com `art. X CPC`, chamam `assertCitationAllowed`.
 */

import { getCorpusManifest, type CorpusManifest } from "@/lib/corpus/manifest";

export type CitationCandidate = {
  /** URN canônica quando disponível. */
  urn?: string;
  /** Referência humana ao artigo (ex.: "art. 300"). */
  articleRef?: string;
  /** Rótulo amigável da norma (ex.: "CPC"). */
  label: string;
  /** Sugestão de uso na peça (alimenta a seção de Lacunas). */
  suggestedUse?: string;
};

export type CitationDecision =
  | { allowed: true }
  | { allowed: false; reason: string; suggestedUse?: string };

export async function assertCitationAllowed(
  c: CitationCandidate,
): Promise<CitationDecision> {
  const manifest = await getCorpusManifest();
  return decide(c, manifest);
}

export function decideCitationSync(
  c: CitationCandidate,
  manifest: CorpusManifest,
): CitationDecision {
  return decide(c, manifest);
}

function decide(c: CitationCandidate, manifest: CorpusManifest): CitationDecision {
  if (c.urn && manifest.availableUrns.has(c.urn)) {
    return { allowed: true };
  }
  if (c.urn) {
    const stem = c.urn.split("::")[0];
    if (stem && manifest.availableUrns.has(stem)) return { allowed: true };
  }
  // Sem URN explícito: tenta inferir pelo label.
  if (!c.urn) {
    const labelLower = c.label.toLowerCase();
    const matchByLabel = manifest.availableNorms.find((n) =>
      labelLower.includes(n.label.toLowerCase()) ||
      n.label.toLowerCase().includes(labelLower),
    );
    if (matchByLabel) return { allowed: true };
  }
  // Caiu fora — sinaliza com hint do manifest se houver.
  const hint = manifest.unavailableHints.find((h) =>
    c.label.toLowerCase().includes(h.label.toLowerCase().slice(0, 8)),
  );
  return {
    allowed: false,
    reason: hint?.reason ?? "Norma fora do corpus indexado atual.",
    ...(c.suggestedUse ? { suggestedUse: c.suggestedUse } : {}),
  };
}

/**
 * Detecta possíveis citações em texto livre que correspondam a normas
 * conhecidas (CPC/ECA/LDB/Lei 12.016/CDC/CC). Útil para o review v2.
 */
export const KNOWN_NORM_PATTERNS: Array<{ re: RegExp; label: string; urnHint: string }> = [
  { re: /\bCPC\b|c[óo]digo\s+de\s+processo\s+civil/i, label: "CPC (Lei 13.105/2015)", urnHint: "urn:lex:br:federal:lei:13.105:2015" },
  { re: /\bECA\b|estatuto\s+da\s+crian[çc]a/i, label: "ECA (Lei 8.069/1990)", urnHint: "urn:lex:br:federal:lei:8.069:1990" },
  { re: /\bLDB\b|lei\s+de\s+diretrizes\s+e\s+bases/i, label: "LDB (Lei 9.394/1996)", urnHint: "urn:lex:br:federal:lei:9.394:1996" },
  { re: /\bLei\s*12\.?016\b/i, label: "Lei do MS (12.016/2009)", urnHint: "urn:lex:br:federal:lei:12.016:2009" },
  { re: /\bCDC\b|c[óo]digo\s+de\s+defesa\s+do\s+consumidor/i, label: "CDC (Lei 8.078/1990)", urnHint: "urn:lex:br:federal:lei:8.078:1990" },
  { re: /\bcc\b|c[óo]digo\s+civil/i, label: "Código Civil (Lei 10.406/2002)", urnHint: "urn:lex:br:federal:lei:10.406:2002" },
];
