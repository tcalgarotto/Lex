/**
 * Normalização canônica de texto jurídico brasileiro.
 *
 * Objetivo: colocar o texto numa forma estável antes do hashing, do chunking
 * e do embedding. Garante que pequenas variações (Unicode NFC vs NFD, espaços
 * exóticos, diferentes símbolos para "§", "º", "ª", quebras de linha) NÃO
 * geram chunks duplicados nem invalidam cache de embeddings.
 *
 * NÃO faz transliteração ASCII (mantém acentos), NÃO faz lowercase, e
 * preserva pontuação relevante para preservar o sentido jurídico.
 */

const ZW_CHARS = /[\u200B\u200C\u200D\u2060\uFEFF]/g; // zero-width
const NBSP_RE = /[\u00A0\u2007\u202F]/g; // non-breaking spaces variants
const SOFT_HYPHEN = /\u00AD/g;

/** Símbolos comuns que vêm "feios" de PDFs/HTML jurídicos. */
const SYMBOL_FIXES: Array<[RegExp, string]> = [
  [/§\s*/g, "§ "],
  [/¶/g, "§"],
  [/º|°/g, "º"],
  [/ª/g, "ª"],
  [/–|—/g, "—"], // tipográfico unificado
  [/[“”„‟]/g, '"'],
  [/[‘’‚‛]/g, "'"],
  [/…/g, "..."],
];

/** Marcadores que normalizamos pra forma canônica. */
const ARTICLE_FIX = /\bart(?:igo)?\.?\s*(\d+)([º°])?/gi;
const PARAGRAPH_FIX = /\bparágrafo\s+único\b/gi;
const SOLE_PARAGRAPH = /\bp[áa]r[áa]grafo\s+[uú]nico\b/gi;
const CAPUT_FIX = /\bcaput\b/gi;

/**
 * Normaliza texto bruto preservando significado jurídico.
 *
 *  - NFC (forma composta de Unicode)
 *  - remove zero-width / soft-hyphen
 *  - troca NBSP por espaço comum
 *  - colapsa whitespace excessivo (mantém 1 linha em branco máximo)
 *  - canonicaliza símbolos jurídicos
 *  - canonicaliza "Art. 5º" / "Parágrafo único" / "caput"
 *
 * Convenção brasileira de numeração de artigos:
 *   - Art. 1º .. Art. 9º  → ordinal (com º)
 *   - Art. 10  .. Art. N  → cardinal puro (sem º)
 * Vide ABNT NBR 6022, Lei Complementar 95/1998 ("Disposições gerais sobre
 * elaboração e redação das leis"). O Planalto e o LexML emitem ambas as
 * formas — aqui canonicalizamos para a oficial.
 */
export function normalizeLegalText(input: string): string {
  let s = input.normalize("NFC");
  s = s.replace(ZW_CHARS, "");
  s = s.replace(SOFT_HYPHEN, "");
  s = s.replace(NBSP_RE, " ");
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (const [re, rep] of SYMBOL_FIXES) {
    s = s.replace(re, rep);
  }

  // Espaços múltiplos → 1; tabs idem.
  s = s.replace(/[ \t]+/g, " ");
  // Linhas com só whitespace viram quebra real
  s = s
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  // No máximo 2 quebras consecutivas (= 1 linha em branco)
  s = s.replace(/\n{3,}/g, "\n\n");

  // Canonicaliza referências a artigos/parágrafos/caput.
  // Ordinal (º) é mandatório em 1..9 e proibido em ≥10 (LC 95/1998).
  s = s.replace(ARTICLE_FIX, (_match, num: string) => {
    const n = Number.parseInt(num, 10);
    return n >= 1 && n <= 9 ? `Art. ${num}º` : `Art. ${num}`;
  });
  s = s.replace(PARAGRAPH_FIX, "Parágrafo único");
  s = s.replace(SOLE_PARAGRAPH, "Parágrafo único");
  s = s.replace(CAPUT_FIX, "caput");

  return s.trim();
}

/**
 * Versão "agressiva" só pra hashing/dedup: além de normalizar, apaga
 * variações cosméticas que NÃO afetam significado jurídico.
 */
export function canonicalizeForHash(input: string): string {
  return normalizeLegalText(input)
    .toLowerCase()
    .replace(/[“”„‟"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
