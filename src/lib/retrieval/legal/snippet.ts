/**
 * Extração de trecho relevante (F3).
 *
 * `extractRelevantSnippet(text, query, maxChars=320)`:
 *   - Se a query menciona inciso/§ específico, recorta janela ao redor
 *     da primeira ocorrência do inciso/§ no texto.
 *   - Caso contrário, recorta janela ao redor da palavra-chave de maior
 *     relevância (mais rara no texto).
 *   - Sempre alinha às bordas de sentença quando possível.
 */

const ROMAN_RE = /\b([IVXLCDM]{1,5})\b/g;

export type SnippetOptions = {
  maxChars?: number;
  /** Adiciona "..." nas bordas quando o snippet não cobre o início/fim. */
  ellipsis?: boolean;
};

export function extractRelevantSnippet(
  text: string,
  query: string,
  opts: SnippetOptions = {},
): string {
  const maxChars = Math.max(80, opts.maxChars ?? 320);
  const ellipsis = opts.ellipsis ?? true;

  if (!text || text.length <= maxChars) return text;

  const incisoTarget = pickIncisoFromQuery(query);
  const paragraphTarget = pickParagraphFromQuery(query);

  let anchor = -1;
  if (incisoTarget) {
    const m = new RegExp(`\\b${incisoTarget}\\b\\s*[—\\-:]?`, "i").exec(text);
    if (m) anchor = m.index;
  }
  if (anchor === -1 && paragraphTarget) {
    const m = new RegExp(`§\\s*${paragraphTarget}`, "i").exec(text);
    if (m) anchor = m.index;
  }
  if (anchor === -1) {
    anchor = pickKeywordAnchor(text, query);
  }
  if (anchor === -1) anchor = 0;

  const half = Math.floor(maxChars / 2);
  let start = Math.max(0, anchor - half);
  let end = Math.min(text.length, start + maxChars);
  if (end - start < maxChars) {
    start = Math.max(0, end - maxChars);
  }

  // Alinha bordas com whitespace/sentence boundary
  start = alignToWordBoundary(text, start, "left");
  end = alignToWordBoundary(text, end, "right");

  let snippet = text.slice(start, end).trim();
  if (ellipsis) {
    if (start > 0) snippet = `… ${snippet}`;
    if (end < text.length) snippet = `${snippet} …`;
  }
  return snippet;
}

function pickIncisoFromQuery(q: string): string | null {
  if (!q) return null;
  // Captura "inciso IV", "inc. IV" ou número romano isolado seguido de "—"/dash
  const incMatch = /\b(?:inc(?:iso)?\.?\s*)([IVXLCDM]{1,5})\b/i.exec(q);
  if (incMatch && incMatch[1]) return incMatch[1].toUpperCase();
  // Algum romano isolado na query (típico de "art. 208 IV")
  const romanMatches = [...q.matchAll(ROMAN_RE)].map((m) => m[1]).filter(Boolean) as string[];
  if (romanMatches.length === 1) return romanMatches[0]!.toUpperCase();
  return null;
}

function pickParagraphFromQuery(q: string): string | null {
  if (!q) return null;
  const m = /(?:§|par[áa]grafo)\s*(\d+)/i.exec(q);
  return m?.[1] ?? null;
}

function pickKeywordAnchor(text: string, query: string): number {
  const lower = text.toLowerCase();
  // Pega palavras com 4+ letras e ordena pela frequência crescente no texto.
  const words = (query.match(/\b[\p{L}]{4,}\b/gu) ?? [])
    .map((w) => w.toLowerCase())
    .filter((w, i, arr) => arr.indexOf(w) === i);
  let bestIdx = -1;
  let bestRarity = Infinity;
  for (const w of words) {
    const idx = lower.indexOf(w);
    if (idx === -1) continue;
    const occurrences = countOccurrences(lower, w);
    if (occurrences < bestRarity) {
      bestRarity = occurrences;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    count += 1;
    pos = haystack.indexOf(needle, pos + needle.length);
  }
  return count;
}

function alignToWordBoundary(text: string, idx: number, side: "left" | "right"): number {
  if (idx <= 0) return 0;
  if (idx >= text.length) return text.length;
  const ch = text.charAt(idx);
  if (/\s/.test(ch)) return idx;
  if (side === "left") {
    // Volta até achar whitespace ou início
    for (let i = idx; i > 0; i -= 1) {
      if (/\s/.test(text.charAt(i))) return i + 1;
    }
    return 0;
  } else {
    for (let i = idx; i < text.length; i += 1) {
      if (/\s/.test(text.charAt(i))) return i;
    }
    return text.length;
  }
}
