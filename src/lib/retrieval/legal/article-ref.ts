/**
 * Normalização de referência a artigo legal (F3).
 *
 * Garante que `Art. 5`, `Art. 5º`, `art 5`, `5º`, `Artigo 5`, `art.5`
 * sejam comparáveis. Também normaliza incisos/parágrafos/alíneas usados
 * pelo chunker v3 (F3.5).
 *
 * Saída canônica para artigo: `Art. 5` (sem ordinal). Variantes
 * suportadas para entrada: case-insensitive, com/sem ponto, com ordinal,
 * com prefixo "Artigo".
 */

const ARTICLE_PARSE_RE =
  /^\s*(?:art(?:igo)?\.?\s*)?(\d+)(?:[ºo°]|\s*º)?\s*$/i;

const INCISO_PARSE_RE = /^\s*(?:inc(?:iso)?\.?\s*)?([ivxlcdm]+)\s*$/i;
const PARAGRAPH_PARSE_RE = /^\s*(?:§|par(?:[áa]grafo)?\.?\s*)\s*(\d+)(?:[ºo°])?\s*$/i;
const ALINEA_PARSE_RE = /^\s*(?:al(?:[íi]nea)?\.?\s*)?([a-z])\s*\)?\s*$/i;

/** Forma canônica para um artigo: "Art. 5". `null` se não casa. */
export function normalizeArticleRef(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  const m = ARTICLE_PARSE_RE.exec(trimmed);
  if (!m || !m[1]) {
    // Tenta extrair "Art. N" do meio de uma string maior.
    const inner = /\bart(?:igo)?\.?\s*(\d+)/i.exec(trimmed);
    if (!inner || !inner[1]) return null;
    return `Art. ${inner[1].replace(/^0+/, "")}`;
  }
  return `Art. ${m[1].replace(/^0+/, "")}`;
}

export function normalizeIncisoRef(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  const m = INCISO_PARSE_RE.exec(trimmed);
  if (!m || !m[1]) return null;
  return m[1].toUpperCase();
}

export function normalizeParagraphRef(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  const m = PARAGRAPH_PARSE_RE.exec(trimmed);
  if (!m || !m[1]) return null;
  return `§ ${m[1].replace(/^0+/, "")}`;
}

export function normalizeAlineaRef(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  const m = ALINEA_PARSE_RE.exec(trimmed);
  if (!m || !m[1]) return null;
  return m[1].toLowerCase();
}

/**
 * Igualdade tolerante a variantes ("Art. 5º" === "art 5" === "5º").
 * Usada por scoring/intent ao casar `intent.articleRefs` com `chunk.articleRef`.
 */
export function articleRefEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeArticleRef(a);
  const nb = normalizeArticleRef(b);
  if (!na || !nb) return false;
  return na === nb;
}

/** True se algum candidato em `haystack` é igual a `needle` (todos normalizados). */
export function articleRefIncludes(
  haystack: ReadonlyArray<string | null | undefined>,
  needle: string | null | undefined,
): boolean {
  const target = normalizeArticleRef(needle);
  if (!target) return false;
  for (const cand of haystack) {
    if (normalizeArticleRef(cand) === target) return true;
  }
  return false;
}
