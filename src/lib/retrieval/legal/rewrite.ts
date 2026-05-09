/**
 * Query rewriting jurídico (determinístico, sem LLM).
 *
 * Gera variações da query original que ajudam recall:
 *   - Forma canônica das citações (Lei 8078 ↔ "Código de Defesa do Consumidor").
 *   - Expansão de aliases (CF ↔ "Constituição Federal", CC ↔ "Código Civil").
 *   - Forma "limpa" (sem pontuação/stopwords) e "núcleo de termos jurídicos".
 *
 * Saída: lista de queries únicas, ordenadas por especificidade.
 *
 * Não substitui um LLM rewriter; é determinístico, rápido e cacheável.
 */

import type { LegalIntent } from "./intent";
import { expandTopicAliases } from "./topic-aliases";

const STOPWORDS_PT = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos",
  "e", "ou", "que", "qual", "quais",
  "para", "por", "com", "sem", "sobre",
  "no", "na", "nos", "nas",
  "se", "isso", "isto", "este", "esta", "esse", "essa",
]);

const ALIASES: Array<{ pattern: RegExp; canonical: string; synonyms: string[] }> = [
  {
    pattern: /\b(CDC|c[óo]digo\s+de\s+defesa\s+do\s+consumidor)\b/gi,
    canonical: "Código de Defesa do Consumidor",
    synonyms: ["Lei 8078/1990", "Lei nº 8.078/1990"],
  },
  {
    pattern: /\b(CF\/?88|constitui[çc][ãa]o\s+federal|constitui[çc][ãa]o\s+da\s+rep[úu]blica)\b/gi,
    canonical: "Constituição Federal",
    synonyms: ["CF/88", "Constituição da República"],
  },
  {
    pattern: /\b(CC|c[óo]digo\s+civil)\b/gi,
    canonical: "Código Civil",
    synonyms: ["Lei 10406/2002"],
  },
  {
    pattern: /\b(CPC|c[óo]digo\s+de\s+processo\s+civil)\b/gi,
    canonical: "Código de Processo Civil",
    synonyms: ["Lei 13105/2015", "novo CPC"],
  },
  {
    pattern: /\b(CP|c[óo]digo\s+penal)\b/gi,
    canonical: "Código Penal",
    synonyms: ["Decreto-Lei 2848/1940"],
  },
  {
    pattern: /\b(CLT|consolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho)\b/gi,
    canonical: "Consolidação das Leis do Trabalho",
    synonyms: ["Decreto-Lei 5452/1943"],
  },
  {
    pattern: /\b(CTN|c[óo]digo\s+tribut[áa]rio\s+nacional)\b/gi,
    canonical: "Código Tributário Nacional",
    synonyms: ["Lei 5172/1966"],
  },
];

export type RewriteContext = {
  /** Áreas detectadas pelo CaseBrain (ex.: ["Educação", "Infância"]). */
  areas?: string[];
  /** Resumo do problema do caso (alimenta expansão temática). */
  problem?: string;
};

/** Produz queries reformuladas: (1) original, (2) com aliases canônicos, (3) com sinônimos extras. */
export function rewriteLegalQuery(
  rawQuery: string,
  intent?: LegalIntent,
  ctx?: RewriteContext,
): string[] {
  const variants = new Set<string>();
  const original = rawQuery.trim();
  if (!original) return [];
  variants.add(original);

  // Variação 1: substitui aliases pela forma canônica
  let canonical = original;
  for (const a of ALIASES) {
    canonical = canonical.replace(a.pattern, a.canonical);
  }
  if (canonical !== original) variants.add(canonical);

  // Variação 2: adiciona sinônimos como sufixo " — also: ..."
  const expansions: string[] = [];
  for (const a of ALIASES) {
    if (a.pattern.test(original)) {
      a.pattern.lastIndex = 0;
      expansions.push(...a.synonyms);
    }
  }
  if (expansions.length > 0) {
    variants.add(`${canonical} ${expansions.join(" ")}`);
  }

  // Variação 3: núcleo de termos jurídicos (remove stopwords e normaliza)
  const core = stripToCoreTerms(canonical);
  if (core && core !== canonical) variants.add(core);

  // Variação 4: se intent traz article refs, adiciona à frase
  if (intent && intent.articleRefs.length > 0) {
    variants.add(`${canonical} ${intent.articleRefs.join(" ")}`);
  }

  // Variação 5 (F3): expansão temática a partir do brain.areas/problem.
  if (ctx) {
    const expansions = expandTopicAliases({
      text: [original, ctx.problem ?? ""].join(" "),
      areas: ctx.areas ?? [],
    });
    if (expansions.length > 0) {
      variants.add(`${canonical} ${expansions.slice(0, 6).join(" ")}`);
    }
  }

  // Variação 6 (F3 QA creche): queries sobre educação infantil sem número de artigo
  // na frase — ancoram explicitamente ao Art. 208 IV para não perder recall para
  // ADCT Art. 81/56 (confusão histórica no briefing).
  const EDU_INFANTIL_CRECHE =
    /\b(creche|educa[cç][aã]o\s+infantil|ber[cç][aá]rio|pr[ée]-?\s*escola|vaga\s+em\s+creche|menor\s+de\s*5\s*anos)\b/i;
  if (EDU_INFANTIL_CRECHE.test(original) && !/\bart\.?\s*208\b/i.test(original)) {
    variants.add(
      `${canonical} Art. 208 IV educação infantil creche berçário pré-escola dever do Estado`,
    );
  }

  return Array.from(variants);
}

/** Remove pontuação e stopwords; mantém termos com >= 3 chars ou números. */
export function stripToCoreTerms(text: string): string {
  const tokens = text
    .normalize("NFC")
    .replace(/["“”'’\(\)\[\]\.,;:!?]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t && (!STOPWORDS_PT.has(t) || /\d/.test(t)) && (t.length >= 3 || /\d/.test(t)));
  return tokens.join(" ");
}

/**
 * Para BM25, queremos uma string que `websearch_to_tsquery` aceite.
 * Removemos operadores reservados e mantemos termos.
 */
export function toTsQueryString(text: string): string {
  return text
    .replace(/[<>!&|:*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
