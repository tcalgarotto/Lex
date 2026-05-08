/**
 * Parser do markdown oficial da Constituição Federal de 1988.
 *
 * O markdown vive em `codigos de leis/CONSTITUICAO.md` e foi diagramado
 * com a hierarquia padrão da CF:
 *
 *   # Constituição da República Federativa do Brasil
 *   ## Título I: Dos Princípios Fundamentais
 *   ### Capítulo I: Dos Direitos e Deveres Individuais e Coletivos
 *   #### Seção I: Disposições Gerais
 *   **Art. 1º** ...
 *     I - inciso 1
 *    **§ 1º** parágrafo
 *   **Art. 2º** ...
 *
 * E uma segunda parte com numeração própria:
 *
 *   ## Ato das Disposições Constitucionais Transitórias
 *   **Art. 1º** ...
 *
 * O parser produz uma estrutura compatível com `ParsedLaw` do Planalto, de
 * modo que o pipeline downstream (`upsertCorpusPayload` →
 * `embedAndUpsertNormVersion`) não precisa diferenciar a fonte. O parser
 * preserva breadcrumb completo em `ParsedArticle.fullPath`, e marca
 * artigos do ADCT com o prefixo "ADCT > " no breadcrumb e
 * `metadata.segment === "ADCT"`.
 */

import type { ParsedArticle, ParsedLaw, ParsedParagraph } from "./planalto-parser";

const TITLE_RE = /^# (.+)$/;
const TITULO_RE = /^## (Título\s+[IVXLCDM\d]+\s*[:\-—]?\s*.+)$/i;
const ADCT_RE = /^## (Ato das Disposi[çc][õo]es Constitucionais Transit[óo]rias.*)$/i;
const PREAMBLE_HEADING_RE = /^##\s*(Pre[âa]mbulo|Disposi[çc][õo]es Preliminares).*$/i;
const CAPITULO_RE = /^### (Cap[íi]tulo\s+[IVXLCDM\d]+\s*[:\-—]?\s*.+)$/i;
const SECAO_RE = /^#{4,5} (Se[çc][ãa]o\s+[IVXLCDM\d]+\s*[:\-—]?\s*.+)$/i;
const SUBSECAO_RE = /^#{4,6}\s+(Subse[çc][ãa]o\s+[IVXLCDM\d]+\s*[:\-—]?\s*.+)$/i;

/**
 * Marca de início de artigo. Aceita dois formatos comumente encontrados em
 * markdowns oficiais:
 *
 *   1. Bold inline:  `**Art. 1º** A República...`
 *   2. Heading h4:   `#### Art. 1º A República...`   ← formato preferido
 *
 * Sufixo (`-A`, `-B`, …) exige HÍFEN explícito (com ou sem espaços ao redor),
 * caso contrário a letra inicial do caput vira falso-positivo. Exemplos:
 *
 *   `**Art. 1º** A República...`          → suffix=undefined (correto)
 *   `**Art. 29-A** O total...`            → suffix=A
 *   `**Art. 313 -A.** Caso...` (Planalto) → suffix=A
 *
 * Grupos: 1=número (com pontos de milhar opcionais), 2=sufixo, 3=resto.
 */
const ARTICLE_HEADER_RE =
  /^\s*(?:\*\*|#{2,6}\s+)Art\.\s*(\d+(?:\.\d{3})*)(?:[º°ªo])?(?:\s*-\s*([A-Z]))?\.?(?:\*\*)?\s*(.*)$/u;

/** § Nº ou § N. ou § Parágrafo único. */
const PARAGRAPH_HEADER_RE =
  /^\s*\*\*\s*(?:§\s*\d+(?:[º°ªo])?\.?|Par[áa]grafo\s+[ÚUú]nico\.?)\s*\*\*\s*(.*)$/iu;
/** I - / II - / III - texto. Aceita até 6 chars de indentação. */
const INCISO_LINE_RE = /^\s{0,6}([IVXLCDM]+)\s*[\-–—]\s+(.+)$/u;
/**
 * Alíneas: aceita as variações usadas em markdowns oficiais:
 *   `  a) texto`           (sem ênfase)
 *   `  _a_) texto`         (italic em volta da letra)
 *   `  _a)_ texto`         (italic em volta da letra-e-parêntese — formato CF)
 *   `  a)_ texto`          (italic só depois)
 */
const ALINEA_LINE_RE = /^\s{0,8}_?([a-z])_?\)_?\s+(.+)$/u;
/** Empty/whitespace-only line. */
const BLANK_RE = /^\s*$/u;

/** Limpa marcadores markdown leves preservando o texto. */
function stripInlineMarks(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza referência canônica de artigo. Convenção da CF/Planalto:
 *   - "Art. 1º" .. "Art. 9º" usam ordinal sobrescrito.
 *   - "Art. 10" .. "Art. 250" usam número puro.
 *   - "Art. 29-A" mantém o sufixo (sem ordinal).
 */
function canonicalArticleRef(num: string, suffix?: string): string {
  if (suffix) return `Art. ${num}-${suffix.toUpperCase()}`;
  const n = Number.parseInt(num, 10);
  return n >= 1 && n <= 9 ? `Art. ${num}º` : `Art. ${num}`;
}

type Segment = "MAIN" | "ADCT";

type Crumb = {
  titulo?: string;
  capitulo?: string;
  secao?: string;
  subsecao?: string;
};

function buildFullPath(segment: Segment, lawTitle: string, crumb: Crumb, articleRef: string): string {
  const parts: string[] = [];
  parts.push(segment === "ADCT" ? `${lawTitle} > ADCT` : lawTitle);
  if (crumb.titulo) parts.push(crumb.titulo);
  if (crumb.capitulo) parts.push(crumb.capitulo);
  if (crumb.secao) parts.push(crumb.secao);
  if (crumb.subsecao) parts.push(crumb.subsecao);
  parts.push(articleRef);
  return parts.join(" > ");
}

/** Limpa `Título I: Dos...` → `Título I — Dos...` (ASCII safe). */
function tidyHeading(raw: string): string {
  return raw.replace(/[\u00A0\s]+/g, " ").trim();
}

export type CfParseStats = {
  articlesMain: number;
  articlesAdct: number;
  paragraphs: number;
  bytes: number;
};

export type CfParsedLaw = ParsedLaw & {
  segments: Array<{
    segment: Segment;
    articles: ParsedArticle[];
  }>;
  cfStats: CfParseStats;
};

type AccumulatedArticle = {
  segment: Segment;
  ref: string;
  number: string;
  numberInt: number;
  suffix?: string;
  caput: string;
  paragraphs: ParsedParagraph[];
  fullPath: string;
  isRevoked: boolean;
};

function pushParagraph(
  acc: AccumulatedArticle,
  ref: string,
  text: string,
): void {
  acc.paragraphs.push({
    ref,
    text,
    anchor: "",
    fullPath: `${acc.fullPath} > ${ref}`,
  });
}

function articleToFinal(a: AccumulatedArticle): ParsedArticle {
  const caputClean = stripInlineMarks(a.caput);
  const paragraphsText = a.paragraphs
    .map((p) => `${p.ref} ${p.text}`.trim())
    .filter(Boolean)
    .join("\n");
  const fullText = paragraphsText
    ? `${a.ref} ${caputClean}\n${paragraphsText}`.trim()
    : `${a.ref} ${caputClean}`.trim();
  return {
    ref: a.ref,
    number: a.number,
    numberInt: a.numberInt,
    ...(a.suffix ? { suffix: a.suffix } : {}),
    caput: caputClean,
    text: fullText,
    paragraphs: a.paragraphs,
    anchor: "",
    fullPath: a.fullPath,
    isRevoked: a.isRevoked,
  };
}

/**
 * Parse o markdown oficial da CF e devolve a `ParsedLaw` canônica.
 * Erros de formatação não jogam — devolvem 0 artigos no segmento, e o caller
 * decide o que fazer.
 */
export function parseConstitutionMarkdown(md: string): CfParsedLaw {
  const lines = md.split(/\r?\n/);

  let lawTitle = "Constituição da República Federativa do Brasil";
  const crumb: Crumb = {};
  let segment: Segment = "MAIN";
  const articles: AccumulatedArticle[] = [];
  let current: AccumulatedArticle | null = null;
  let preamble: string | undefined;
  let inPreamble = false;
  const preambleBuf: string[] = [];

  const flushArticle = (): void => {
    if (!current) return;
    articles.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (BLANK_RE.test(line)) continue;

    // Headings primeiro — eles fecham o artigo atual.
    const titleMatch = TITLE_RE.exec(line);
    if (titleMatch) {
      flushArticle();
      lawTitle = stripInlineMarks(titleMatch[1] ?? lawTitle);
      // Reseta breadcrumb.
      crumb.titulo = undefined;
      crumb.capitulo = undefined;
      crumb.secao = undefined;
      crumb.subsecao = undefined;
      continue;
    }

    if (ADCT_RE.test(line)) {
      flushArticle();
      segment = "ADCT";
      // Quando entramos em ADCT, o breadcrumb já carrega "ADCT" via
      // `buildFullPath` (segment), então não duplicamos aqui no titulo.
      crumb.titulo = undefined;
      crumb.capitulo = undefined;
      crumb.secao = undefined;
      crumb.subsecao = undefined;
      continue;
    }
    if (PREAMBLE_HEADING_RE.test(line)) {
      flushArticle();
      inPreamble = true;
      continue;
    }
    const tituloMatch = TITULO_RE.exec(line);
    if (tituloMatch) {
      flushArticle();
      crumb.titulo = tidyHeading(tituloMatch[1] ?? "");
      crumb.capitulo = undefined;
      crumb.secao = undefined;
      crumb.subsecao = undefined;
      continue;
    }
    const capMatch = CAPITULO_RE.exec(line);
    if (capMatch) {
      flushArticle();
      crumb.capitulo = tidyHeading(capMatch[1] ?? "");
      crumb.secao = undefined;
      crumb.subsecao = undefined;
      continue;
    }
    const secMatch = SECAO_RE.exec(line);
    if (secMatch) {
      flushArticle();
      crumb.secao = tidyHeading(secMatch[1] ?? "");
      crumb.subsecao = undefined;
      continue;
    }
    const subSecMatch = SUBSECAO_RE.exec(line);
    if (subSecMatch) {
      flushArticle();
      crumb.subsecao = tidyHeading(subSecMatch[1] ?? "");
      continue;
    }

    // Preâmbulo.
    if (/^\s*\*\*Pre[âa]mbulo\*\*\s*$/iu.test(line)) {
      flushArticle();
      inPreamble = true;
      continue;
    }
    if (inPreamble && !ARTICLE_HEADER_RE.test(line)) {
      preambleBuf.push(stripInlineMarks(line));
      continue;
    }

    // Artigo.
    const artMatch = ARTICLE_HEADER_RE.exec(line);
    if (artMatch) {
      flushArticle();
      inPreamble = false;
      const numRaw = (artMatch[1] ?? "").replace(/\./g, "");
      const suffix = artMatch[2]?.toUpperCase();
      const numInt = Number.parseInt(numRaw, 10);
      const ref = canonicalArticleRef(numRaw, suffix);
      const fullPath = buildFullPath(segment, lawTitle, crumb, ref);
      const initialCaput = stripInlineMarks(artMatch[3] ?? "");
      const isRevoked = /Revogad[ao]/i.test(initialCaput) && initialCaput.length < 200;
      current = {
        segment,
        ref,
        number: suffix ? `${numRaw}-${suffix}` : numRaw,
        numberInt: Number.isFinite(numInt) ? numInt : 0,
        ...(suffix ? { suffix } : {}),
        caput: initialCaput,
        paragraphs: [],
        fullPath,
        isRevoked,
      };
      continue;
    }

    // Dentro de um artigo: parágrafo, inciso, alínea ou continuação do caput.
    if (current) {
      const paraMatch = PARAGRAPH_HEADER_RE.exec(line);
      if (paraMatch) {
        // Recupera o cabeçalho exato (§ 1º / Parágrafo único.) do markdown.
        const header = (line.match(/\*\*\s*([^*]+?)\s*\*\*/) ?? [, "§"])[1] ?? "§";
        const text = stripInlineMarks(paraMatch[1] ?? "");
        pushParagraph(current, header.replace(/\s+/g, " ").trim(), text);
        continue;
      }
      const incMatch = INCISO_LINE_RE.exec(line);
      if (incMatch) {
        const ref = `${incMatch[1]}`;
        const text = stripInlineMarks(incMatch[2] ?? "");
        pushParagraph(current, ref, text);
        continue;
      }
      const aliMatch = ALINEA_LINE_RE.exec(line);
      if (aliMatch) {
        const letter = (aliMatch[1] ?? "").toLowerCase();
        const text = stripInlineMarks(aliMatch[2] ?? "");
        pushParagraph(current, `${letter})`, text);
        continue;
      }
      // Continuação do caput.
      current.caput = `${current.caput} ${stripInlineMarks(line)}`.trim();
    }
  }

  flushArticle();
  if (preambleBuf.length > 0) preamble = preambleBuf.join("\n").trim();

  const main = articles.filter((a) => a.segment === "MAIN").map(articleToFinal);
  const adct = articles.filter((a) => a.segment === "ADCT").map(articleToFinal);
  const all = [...main, ...adct];

  const stats = {
    articlesTotal: all.length,
    articlesRevoked: all.filter((a) => a.isRevoked).length,
    paragraphsTotal: all.reduce((acc, a) => acc + a.paragraphs.length, 0),
    bytes: Buffer.byteLength(md, "utf8"),
  };

  const cfStats: CfParseStats = {
    articlesMain: main.length,
    articlesAdct: adct.length,
    paragraphs: stats.paragraphsTotal,
    bytes: stats.bytes,
  };

  return {
    title: lawTitle,
    ...(preamble ? { preamble } : {}),
    articles: all,
    stats,
    segments: [
      { segment: "MAIN", articles: main },
      { segment: "ADCT", articles: adct },
    ],
    cfStats,
  };
}
