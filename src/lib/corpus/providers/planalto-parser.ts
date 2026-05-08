/**
 * Parser de leis/códigos do Planalto.
 *
 * Heurística (validada contra Lei 11.340/2006, CPC, CDC, CC):
 *   - Cada artigo é um `<p class="MsoNormal">` com âncora `<a name="artN">`.
 *   - § (parágrafos) usam âncora `art<N>§<M>` ou começam com `§ N°`.
 *   - Incisos romanos têm âncora `art<N>i…` ou começam com `I -`, `II -`, etc.
 *   - Alíneas têm âncora `art<N>iN<letra>` ou começam com `a)`, `b)`.
 *   - Títulos/Capítulos são `<p align="center">` com âncoras `titulo*` / `capitulo*`.
 *
 * O parser é **conservador**:
 *   - Se não encontra ancoras `art\d+`, retorna 0 artigos (caller decide).
 *   - Texto vazio / artigos vazios ficam fora do output.
 *   - "Art. N° (Revogado…)" é marcado com `isRevoked: true` mas o texto é
 *     preservado para auditoria.
 */

import { load, type CheerioAPI } from "cheerio";

export type ParsedParagraph = {
  ref: string;
  text: string;
  anchor: string;
  fullPath: string;
};

export type ParsedArticle = {
  /** Texto canônico, ex.: "Art. 1º", "Art. 12-A". Sempre preenchido. */
  ref: string;
  /** Identificador canônico do artigo, ex.: "1", "12-A". */
  number: string;
  /** Numeração ordinal pura (sem sufixo), ex.: 1, 12. Útil para ordenação. */
  numberInt: number;
  /** Sufixo (`-A`, `-B`...) quando presente. */
  suffix?: string;
  /** Texto completo do artigo (caput + § + incisos + alíneas, em ordem de leitura). */
  text: string;
  /** Texto só do caput, sem § / incisos. */
  caput: string;
  /** §, incisos e alíneas extraídos. Os mesmos textos já estão em `text`. */
  paragraphs: ParsedParagraph[];
  /** Âncora HTML original, ex.: "art1". */
  anchor: string;
  /** Caminho hierárquico para `LegalChunk.fullPath`. */
  fullPath: string;
  /** True quando o artigo foi explicitamente revogado. */
  isRevoked: boolean;
};

export type ParsedLawStats = {
  articlesTotal: number;
  articlesRevoked: number;
  paragraphsTotal: number;
  bytes: number;
};

export type ParsedLaw = {
  /** Título extraído de `<title>`. */
  title?: string;
  /** Texto da ementa, se presente em `<p class="ementa">` ou similar. */
  preamble?: string;
  articles: ParsedArticle[];
  stats: ParsedLawStats;
};

/** Anchors de artigo: `art1`, `art12a`, `art12-a`, `art12.` (Planalto usa todas). */
const ARTICLE_ANCHOR_RE = /^art(\d+)(?:[-_]?([a-z]))?\.?$/i;
/** Anchors de § como `art5§1`, `art5pu`, `art10p`, `art12a§1`. */
const PARAGRAPH_ANCHOR_RE = /^art\d+[a-z]?(?:§|p[a-z0-9]+|p$|paragrafo)/i;
/** Anchors de inciso (romano): art5i, art5ii, art5iii, art5iv, art5x… */
const INCISO_ANCHOR_RE = /^art\d+[a-z]?([ivxlc]+)$/i;
/** Anchors de alínea: art5ia, art5iib. */
const ALINEA_ANCHOR_RE = /^art\d+[a-z]?([ivxlc]+)([a-z])$/i;
const SECTION_ANCHOR_RE = /^(titulo|capitulo|secao|seção|livro|parte|preambulo|preâmbulo|disposicoes|disposições)/i;

/** Captura "Art. 1º", "Art. 12-A", "Art. 313 -A", "Art. 2 -B". */
const ARTICLE_TEXT_RE = /^Art\.\s*(\d+)(?:\s*[-–—_]\s*([A-Za-z]))?(?:[º°ªo])?\s*[\.\-–—]?\s*/u;
const PARAGRAPH_TEXT_RE = /^§\s*(\d+|único|unico)?(?:[º°ªo])?\s*[\.\-–—]?\s*/iu;
/** Inciso clássico: "I -", "II -", "XXIV –". */
const INCISO_TEXT_RE = /^([IVXLC]{1,4})\s*[\-–—]\s*/u;
const ALINEA_TEXT_RE = /^([a-zà-ÿ])\)\s*/iu;
const REVOKED_RE = /\(\s*Revogad[oa]\b/iu;

type Unit =
  | {
      type: "article";
      ref: string;
      number: string;
      numberInt: number;
      suffix?: string;
      text: string;
      anchor: string;
    }
  | { type: "paragraph"; ref: string; text: string; anchor: string }
  | { type: "inciso"; ref: string; text: string; anchor: string }
  | { type: "alinea"; ref: string; text: string; anchor: string }
  | { type: "section"; text: string; anchor: string }
  | { type: "other"; text: string };

function normalizeText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildArticleRef(num: string, suffix?: string): string {
  const baseLabel = num.length <= 3 ? `${num}º` : num;
  return suffix ? `Art. ${baseLabel}-${suffix.toUpperCase()}` : `Art. ${baseLabel}`;
}

function extractArticleParts(text: string): { num: string; suffix?: string } | null {
  const m = text.match(ARTICLE_TEXT_RE);
  if (!m || !m[1]) return null;
  const suffix = m[2]?.toUpperCase();
  return suffix ? { num: m[1], suffix } : { num: m[1] };
}

function detectAnchorType(anchor: string | undefined): Unit["type"] | null {
  if (!anchor) return null;
  // ORDEM IMPORTA: § / inciso / alínea precisam ser checados ANTES de
  // article, porque uma âncora como `art11v` (inciso V) tem número e
  // letra exatamente como um sufixo de artigo `art12a`. Distinguimos
  // pelo conjunto de caracteres romanos vs sufixo livre.
  if (PARAGRAPH_ANCHOR_RE.test(anchor)) return "paragraph";
  if (ALINEA_ANCHOR_RE.test(anchor)) return "alinea";
  if (INCISO_ANCHOR_RE.test(anchor)) return "inciso";
  if (SECTION_ANCHOR_RE.test(anchor)) return "section";
  if (ARTICLE_ANCHOR_RE.test(anchor)) return "article";
  return null;
}

function buildUnitFromParagraph(
  $: CheerioAPI,
  el: ReturnType<CheerioAPI>[number],
): Unit | null {
  const $p = $(el);
  // Âncora `<a name="...">` — primeira que aparecer dentro do <p>.
  const anchor = $p.find("a[name]").first().attr("name") || undefined;
  const text = normalizeText($p.text());
  if (!text) return null;

  // 1) Decisão por âncora (mais confiável).
  const anchorType = detectAnchorType(anchor);
  if (anchorType === "article") {
    const am = (anchor || "").match(ARTICLE_ANCHOR_RE);
    const numStr = am?.[1] ?? "0";
    const numberInt = Number(numStr);
    // Suffix preferencial vem do TEXTO (mais confiável que a âncora,
    // que pode estar truncada como `art12c.`).
    const fromText = extractArticleParts(text);
    const suffix = fromText?.suffix ?? am?.[2]?.toUpperCase();
    const number = suffix ? `${numStr}-${suffix}` : numStr;
    const ref = buildArticleRef(numStr, suffix);
    return {
      type: "article",
      ref,
      number,
      numberInt,
      ...(suffix ? { suffix } : {}),
      text,
      anchor: anchor as string,
    };
  }
  if (anchorType === "paragraph") {
    const refMatch = text.match(PARAGRAPH_TEXT_RE);
    const ref = refMatch
      ? refMatch[0].includes("ún") || refMatch[0].includes("un")
        ? "Parágrafo único"
        : `§ ${refMatch[1]}º`
      : "§";
    return { type: "paragraph", ref, text, anchor: anchor as string };
  }
  if (anchorType === "alinea") {
    const refMatch = text.match(ALINEA_TEXT_RE);
    const ref = refMatch && refMatch[1] ? `${refMatch[1].toLowerCase()})` : ")";
    return { type: "alinea", ref, text, anchor: anchor as string };
  }
  if (anchorType === "inciso") {
    const refMatch = text.match(INCISO_TEXT_RE);
    const ref = refMatch && refMatch[1] ? refMatch[1].toUpperCase() : "—";
    return { type: "inciso", ref, text, anchor: anchor as string };
  }
  if (anchorType === "section") {
    return { type: "section", text, anchor: anchor as string };
  }

  // 2) Sem âncora — usa regex no texto. Útil pra páginas mais antigas.
  const fromText = extractArticleParts(text);
  if (fromText) {
    const numberInt = Number(fromText.num);
    const number = fromText.suffix ? `${fromText.num}-${fromText.suffix}` : fromText.num;
    const ref = buildArticleRef(fromText.num, fromText.suffix);
    return {
      type: "article",
      ref,
      number,
      numberInt,
      ...(fromText.suffix ? { suffix: fromText.suffix } : {}),
      text,
      anchor: `art${number.toLowerCase().replace("-", "")}`,
    };
  }
  if (PARAGRAPH_TEXT_RE.test(text)) {
    const refMatch = text.match(PARAGRAPH_TEXT_RE);
    const ref = refMatch
      ? refMatch[0].includes("ún") || refMatch[0].includes("un")
        ? "Parágrafo único"
        : `§ ${refMatch[1]}º`
      : "§";
    return { type: "paragraph", ref, text, anchor: "" };
  }
  if (INCISO_TEXT_RE.test(text)) {
    const refMatch = text.match(INCISO_TEXT_RE);
    const ref = refMatch && refMatch[1] ? refMatch[1].toUpperCase() : "—";
    return { type: "inciso", ref, text, anchor: "" };
  }
  if (ALINEA_TEXT_RE.test(text)) {
    const refMatch = text.match(ALINEA_TEXT_RE);
    const ref = refMatch && refMatch[1] ? `${refMatch[1].toLowerCase()})` : ")";
    return { type: "alinea", ref, text, anchor: "" };
  }
  return { type: "other", text };
}

/**
 * Parseia uma página HTML do Planalto contendo uma lei/código.
 *
 * Retorna `{ articles, stats }`. O caller (Provider) é quem decide
 * o que fazer quando `articles.length === 0` (ex.: lançar erro).
 */
export function parsePlanaltoLawHtml(html: string): ParsedLaw {
  const $ = load(html);
  const title = $("title").text().trim() || undefined;

  const units: Unit[] = [];
  $("p").each((_, el) => {
    const u = buildUnitFromParagraph($, el);
    if (u) units.push(u);
  });

  const articles: ParsedArticle[] = [];
  const seenArticleNumbers = new Set<string>();
  let current: ParsedArticle | null = null;

  for (const u of units) {
    if (u.type === "article") {
      // Dedup: Planalto às vezes repete o mesmo artigo (ex.: "Art. 12-C"
      // aparece 2x na página da LMP, com texto idêntico). Pulamos a
      // segunda ocorrência se o número canônico já foi consumido.
      if (seenArticleNumbers.has(u.number)) {
        // Se o texto novo for substancialmente maior, sobrescreve (a
        // primeira ocorrência pode ter sido um stub).
        const prev = articles.find((a) => a.number === u.number);
        if (prev && u.text.length > prev.text.length * 1.5) {
          prev.text = u.text;
          prev.caput = u.text;
        }
        continue;
      }
      if (current) articles.push(current);
      seenArticleNumbers.add(u.number);
      current = {
        ref: u.ref,
        number: u.number,
        numberInt: u.numberInt,
        ...(u.suffix ? { suffix: u.suffix } : {}),
        text: u.text,
        caput: u.text,
        paragraphs: [],
        anchor: u.anchor,
        fullPath: u.ref,
        isRevoked: REVOKED_RE.test(u.text),
      };
    } else if (
      current &&
      (u.type === "paragraph" || u.type === "inciso" || u.type === "alinea")
    ) {
      current.text += "\n" + u.text;
      current.paragraphs.push({
        ref: u.ref,
        text: u.text,
        anchor: u.anchor,
        fullPath: `${current.ref}, ${u.ref}`,
      });
      if (REVOKED_RE.test(u.text) && /todo|inteiro/i.test(u.text)) {
        current.isRevoked = true;
      }
    }
    // section / other: ignora (são headers e quebras visuais).
  }
  if (current) articles.push(current);

  const stats: ParsedLawStats = {
    articlesTotal: articles.length,
    articlesRevoked: articles.filter((a) => a.isRevoked).length,
    paragraphsTotal: articles.reduce((acc, a) => acc + a.paragraphs.length, 0),
    bytes: html.length,
  };

  return { title, articles, stats };
}

/**
 * Detecta o encoding do HTML servido pelo Planalto (algumas páginas vêm
 * em UTF-16 LE com BOM, outras em ISO-8859-1, raras em UTF-8).
 */
export function decodePlanaltoBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // BOM UTF-16 LE: FF FE
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  // BOM UTF-16 BE: FE FF
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  // BOM UTF-8: EF BB BF
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  // Heurística: se metade dos bytes são 0x00, é UTF-16.
  const sampleLen = Math.min(bytes.length, 1000);
  let nullBytes = 0;
  for (let i = 1; i < sampleLen; i += 2) {
    if (bytes[i] === 0x00) nullBytes++;
  }
  if (nullBytes > sampleLen / 4) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  // Tenta UTF-8 strict; fallback ISO-8859-1.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}
