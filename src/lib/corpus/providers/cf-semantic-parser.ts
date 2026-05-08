/**
 * Parser do markdown semântico da Constituição Federal de 1988.
 *
 * Formato esperado (curado pelo time + `scripts/normalize-constitucao-md.ts`):
 *
 *   # CONSTITUICAO_FEDERAL
 *   ## TITULO_I
 *   [ARTIGO:1]
 *   [META]
 *   codigo=CF
 *   tipo=CONSTITUICAO
 *   hierarquia=TITULO_I>PRINCIPIOS_FUNDAMENTAIS
 *   tema=principios_fundamentais
 *   artigo=1
 *   vigencia=1988
 *   [/META]
 *
 *   A República Federativa do Brasil ...
 *
 *   [INCISO:I]
 *   a soberania;
 *
 *   [PARAGRAFO:UNICO]
 *   Todo o poder emana do povo ...
 *
 *   ...
 *
 *   # ADCT
 *   [ARTIGO:1]
 *   [META]
 *   codigo=ADCT
 *   ...
 *
 *   [DOCUMENT_NOTE]
 *   Brasília, 5 de outubro de 1988.
 *
 * Produz `ParsedSemanticArticle[]`, com:
 *   - bloco [META] como fonte primária da hierarquia (`hierarchy`, `tema`,
 *     `codigo`, `tipo`, `vigencia`, `artigo`);
 *   - texto autocontido sem ruído de tags ([META] e marcadores nunca aparecem
 *     no texto exposto a embeddings);
 *   - estruturas internas (incisos, parágrafos, alíneas) preservadas em ordem
 *     de leitura, com label canônico ("I", "II", "§ 1º", "Parágrafo único",
 *     "a)", etc.) e ref canônica ("Art. 5º LIV", "Art. 29-A § 1º").
 *
 * O parser é **estrito** com [META] (cada [ARTIGO] DEVE ter [META] imediato),
 * mas tolerante com headings ausentes/novos e ordenação alternativa de incisos.
 */

export type SemanticSegment = "MAIN" | "ADCT";

export type SemanticMeta = {
  /** Ex.: "CF" ou "ADCT". Source of truth: campo `codigo` do [META]. */
  codigo: string;
  /** Ex.: "CONSTITUICAO". */
  tipo: string;
  /** Snake-case com `>` separando níveis. Ex.: "TITULO_II>...>SECAO_I". */
  hierarquia: string;
  /** Slug: ex.: "direitos_garantias_fundamentais". */
  tema: string;
  /** Número do artigo (com sufixo se houver), ex.: "1", "29-A". */
  artigo: string;
  /** Ano de vigência declarado (string). Ex.: "1988". */
  vigencia: string;
  /** Demais campos custom do [META] (ignored mas preservados pra debug). */
  extras: Record<string, string>;
};

export type SemanticInternalKind = "INCISO" | "PARAGRAFO" | "ALINEA";

export type SemanticInternal = {
  kind: SemanticInternalKind;
  /** Label canônico humano. Ex.: "I", "§ 1º", "Parágrafo único", "a)". */
  label: string;
  /** Identificador bruto vindo do MD ("I", "1", "UNICO", "a"). */
  rawId: string;
  /** Texto puro da estrutura interna (sem tags). */
  text: string;
};

export type ParsedSemanticArticle = {
  segment: SemanticSegment;
  /** Número do artigo (com sufixo), ex.: "1", "29-A". */
  number: string;
  /** Inteiro pra ordenação. Ex.: 1, 29 (sufixo descartado). */
  numberInt: number;
  /** Sufixo (`A`, `B`...) quando presente. */
  suffix?: string;
  /** Ref canônica humana, ex.: "Art. 1º", "Art. 29-A". */
  ref: string;
  meta: SemanticMeta;
  caput: string;
  internals: SemanticInternal[];
  /** Caminho legível derivado de `meta.hierarquia`. Ex.: "Título II > Direitos
   * e Garantias Fundamentais > Capítulo I > Art. 5º". */
  fullPath: string;
  /**
   * Texto autocontido, com prefixo de hierarquia legível, caput e estruturas.
   * É o texto que vai como `LegalChunk.text` (e como input de embeddings).
   * NUNCA contém o bloco [META] bruto.
   */
  text: string;
};

export type SemanticDocumentNote = {
  text: string;
};

export type CfSemanticParseStats = {
  articlesMain: number;
  articlesAdct: number;
  incisos: number;
  paragrafos: number;
  alineas: number;
  documentNotes: number;
  bytes: number;
};

export type ParsedCfSemantic = {
  title: string;
  preamble?: string;
  articles: ParsedSemanticArticle[];
  segments: { MAIN: ParsedSemanticArticle[]; ADCT: ParsedSemanticArticle[] };
  documentNotes: SemanticDocumentNote[];
  stats: CfSemanticParseStats;
  /** Avisos não-fatais encontrados durante o parse (apenas em strict=false). */
  errors: CfSemanticParseError[];
};

// ──────────────────────── Regex ────────────────────────

const TOP_HEADING_RE = /^# (.+)$/;
const SUB_HEADING_RE = /^## (.+)$/;
const ARTIGO_TAG_RE = /^\[ARTIGO:(\d+)(?:-([A-Z]))?\]$/u;
const META_OPEN_RE = /^\[META\]$/u;
const META_CLOSE_RE = /^\[\/META\]$/u;
const META_KV_RE = /^([a-zA-Z][\w]*)\s*=\s*(.*)$/u;
const INCISO_TAG_RE = /^\[INCISO:([A-Z\d]+(?:-[A-Z\d]+)?)\]$/u;
const PARAGRAFO_TAG_RE = /^\[PARAGRAFO:([\w-]+)\]$/u;
const ALINEA_TAG_RE = /^\[ALINEA:([a-z\d-]+)\]$/u;
const DOCUMENT_NOTE_TAG_RE = /^\[DOCUMENT_NOTE\]$/u;
const PREAMBLE_KEYWORD_RE = /^\s*Pre[âa]mbulo\s*$/iu;

// ──────────────────────── Helpers ────────────────────────

function canonicalArticleRef(num: string, suffix?: string): string {
  if (suffix) return `Art. ${num}-${suffix.toUpperCase()}`;
  const n = Number.parseInt(num, 10);
  return n >= 1 && n <= 9 ? `Art. ${num}º` : `Art. ${num}`;
}

const HIERARCHY_PREFIXES: Array<[RegExp, string]> = [
  [/^TITULO_/u, "Título "],
  [/^CAPITULO_/u, "Capítulo "],
  [/^SECAO_/u, "Seção "],
  [/^SUBSECAO_/u, "Subseção "],
  [/^LIVRO_/u, "Livro "],
  [/^PARTE_/u, "Parte "],
];

const HIERARCHY_STOPWORDS = new Set([
  "e",
  "a",
  "o",
  "as",
  "os",
  "da",
  "de",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "por",
]);

/** Siglas curtas que devem ser preservadas em maiúsculo. */
const HIERARCHY_ACRONYMS = new Set(["ADCT", "STF", "STJ", "TST", "CNJ", "CNMP", "TCU"]);

/**
 * "TITULO_II"                → "Título II"
 * "PRINCIPIOS_FUNDAMENTAIS"  → "Princípios Fundamentais"
 * "DIREITOS_E_GARANTIAS"     → "Direitos e Garantias"
 * "CAPITULO_IV"              → "Capítulo IV"
 * "ADCT"                     → "ADCT"
 *
 * Acentos não presentes no token original (snake-case do MD) NÃO são
 * recuperados (ex.: "CIENCIA_TECNOLOGIA_INOVACAO" → "Ciência Tecnologia
 * Inovação" exige dicionário; aceitamos "Ciencia Tecnologia Inovacao"
 * apenas com substituições óbvias e siglas).
 */
function humanizeHierarchyToken(tok: string): string {
  if (HIERARCHY_ACRONYMS.has(tok)) return tok;
  for (const [prefix, replacement] of HIERARCHY_PREFIXES) {
    if (prefix.test(tok)) {
      const rest = tok.replace(prefix, "");
      return `${replacement}${rest}`.trim();
    }
  }
  const words = tok.split(/_+/u).filter(Boolean);
  return words
    .map((w, idx) => {
      if (HIERARCHY_ACRONYMS.has(w)) return w;
      const lower = w.toLowerCase();
      if (idx > 0 && HIERARCHY_STOPWORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** "TITULO_II>...>SECAO_I" + ref → "Título II > ... > Seção I > Art. 5º" */
export function humanizeHierarchy(rawHierarchy: string, ref: string): string {
  const parts = rawHierarchy
    .split(/>/u)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(humanizeHierarchyToken);
  return [...parts, ref].join(" > ");
}

function inscisoLabel(rawId: string): string {
  // Sempre maiúsculo (romano).
  return rawId.toUpperCase();
}

function paragrafoLabel(rawId: string): string {
  const id = rawId.toUpperCase();
  if (id === "UNICO" || id === "ÚNICO" || id === "U") return "Parágrafo único";
  const n = Number.parseInt(id, 10);
  if (Number.isFinite(n)) return n >= 1 && n <= 9 ? `§ ${n}º` : `§ ${n}`;
  return `§ ${rawId}`;
}

function alineaLabel(rawId: string): string {
  return `${rawId.toLowerCase()})`;
}

/**
 * Formato do `text` enviado a embeddings (briefing FASE 4):
 *
 *   "Constituição Federal. Título II. Direitos e Garantias Fundamentais.
 *    Capítulo I. Direitos e Deveres Individuais e Coletivos. Art. 5º.
 *    Todos são iguais perante a lei...
 *    I — homens e mulheres são iguais...
 *    § 1º As normas..."
 *
 * Para artigos do ADCT, prefixo "ADCT." em vez do título do segmento. O
 * caminho hierárquico é separado por "." (mais natural para embeddings) e
 * NUNCA inclui o bloco [META] bruto. `fullPath` (com ">") fica preservado
 * separadamente em `LegalChunk.fullPath` para UI/debug.
 */
function buildArticleText(
  segment: SemanticSegment,
  fullPath: string,
  ref: string,
  caput: string,
  internals: SemanticInternal[],
): string {
  const breadcrumb = fullPath
    .split(/\s*>\s*/u)
    .filter((p) => p && p !== ref); // remove o "Art. Nº" duplicado do final
  const prefix = segment === "ADCT"
    ? ["Constituição Federal", "ADCT", ...breadcrumb]
    : ["Constituição Federal", ...breadcrumb];
  const header = prefix.filter(Boolean).join(". ");
  const body: string[] = [];
  if (caput.trim()) body.push(`${ref}. ${caput}`.trim());
  for (const inner of internals) {
    if (inner.kind === "INCISO") body.push(`${inner.label} — ${inner.text}`.trim());
    else if (inner.kind === "PARAGRAFO") body.push(`${inner.label} ${inner.text}`.trim());
    else body.push(`${inner.label} ${inner.text}`.trim());
  }
  return [header ? `${header}.` : "", body.join("\n")].filter(Boolean).join("\n");
}

function isStructuralTagLine(line: string): boolean {
  return (
    ARTIGO_TAG_RE.test(line) ||
    META_OPEN_RE.test(line) ||
    META_CLOSE_RE.test(line) ||
    INCISO_TAG_RE.test(line) ||
    PARAGRAFO_TAG_RE.test(line) ||
    ALINEA_TAG_RE.test(line) ||
    DOCUMENT_NOTE_TAG_RE.test(line) ||
    /^# /u.test(line) ||
    /^## /u.test(line)
  );
}

// ──────────────────────── Parser ────────────────────────

export type CfSemanticParseError = {
  line: number;
  message: string;
};

export type ParseOptions = {
  /** Quando true, valida estrutura (META obrigatório, sem tags soltas) e
   *  joga em caso de violação. Default = true. */
  strict?: boolean;
};

export function parseConstitutionSemantic(
  md: string,
  options: ParseOptions = {},
): ParsedCfSemantic {
  const strict = options.strict ?? true;
  const lines = md.split(/\r?\n/);
  const articles: ParsedSemanticArticle[] = [];
  const documentNotes: SemanticDocumentNote[] = [];
  const errors: CfSemanticParseError[] = [];

  let topLevel: SemanticSegment = "MAIN";
  let title = "Constituição Federal";
  let preamble: string | undefined;
  let i = 0;

  // Coletor de preâmbulo: tudo que estiver entre `# CONSTITUICAO_FEDERAL` e o
  // primeiro `## TITULO_*` (e não seja heading) entra como preâmbulo.
  let inPreambleCollect = false;
  const preambleBuf: string[] = [];

  const consumeArticle = (
    tagLine: string,
    tagLineNo: number,
  ): ParsedSemanticArticle | null => {
    const m = ARTIGO_TAG_RE.exec(tagLine);
    if (!m) return null;
    const numRaw = m[1] ?? "";
    const suffix = m[2];
    const numberInt = Number.parseInt(numRaw, 10);
    const number = suffix ? `${numRaw}-${suffix}` : numRaw;
    const ref = canonicalArticleRef(numRaw, suffix);

    // Próxima linha não-vazia precisa ser [META].
    let j = i + 1;
    while (j < lines.length && (lines[j] ?? "").trim() === "") j++;
    if (j >= lines.length || !META_OPEN_RE.test((lines[j] ?? "").trim())) {
      const msg = `[ARTIGO:${number}] sem [META] imediato (linha ${tagLineNo + 1}).`;
      errors.push({ line: tagLineNo + 1, message: msg });
      if (strict) throw new Error(msg);
      // No modo lax, abandonamos o artigo e voltamos.
      i = j;
      return null;
    }

    // Lê o META.
    const meta: SemanticMeta = {
      codigo: "",
      tipo: "",
      hierarquia: "",
      tema: "",
      artigo: number,
      vigencia: "",
      extras: {},
    };
    let k = j + 1;
    while (k < lines.length && !META_CLOSE_RE.test((lines[k] ?? "").trim())) {
      const raw = (lines[k] ?? "").trim();
      if (raw) {
        const kv = META_KV_RE.exec(raw);
        if (kv) {
          const key = (kv[1] ?? "").toLowerCase();
          const value = (kv[2] ?? "").trim();
          switch (key) {
            case "codigo":
              meta.codigo = value;
              break;
            case "tipo":
              meta.tipo = value;
              break;
            case "hierarquia":
            case "hierarchy":
              meta.hierarquia = value;
              break;
            case "tema":
              meta.tema = value;
              break;
            case "artigo":
              meta.artigo = value || number;
              break;
            case "vigencia":
              meta.vigencia = value;
              break;
            default:
              meta.extras[key] = value;
          }
        }
      }
      k++;
    }
    if (k >= lines.length) {
      const msg = `[META] não fechado para [ARTIGO:${number}] (linha ${j + 1}).`;
      errors.push({ line: j + 1, message: msg });
      if (strict) throw new Error(msg);
      i = lines.length;
      return null;
    }

    // Validações mínimas do META.
    if (!meta.codigo || !meta.hierarquia) {
      const msg = `[META] incompleto para [ARTIGO:${number}] (codigo='${meta.codigo}', hierarquia='${meta.hierarquia}').`;
      errors.push({ line: j + 1, message: msg });
      if (strict) throw new Error(msg);
    }

    // Após [/META], coleta caput + estruturas até próximo [ARTIGO:...] ou
    // top-level heading (`# `) ou EOF.
    let p = k + 1;
    let caput = "";
    const internals: SemanticInternal[] = [];
    let currentInner: SemanticInternal | null = null;

    const flushInner = (): void => {
      if (currentInner) {
        currentInner.text = currentInner.text.trim();
        if (currentInner.text) internals.push(currentInner);
        currentInner = null;
      }
    };

    const appendText = (line: string): void => {
      if (currentInner) {
        currentInner.text = `${currentInner.text} ${line}`.trim();
      } else {
        caput = `${caput} ${line}`.trim();
      }
    };

    while (p < lines.length) {
      const raw = lines[p] ?? "";
      const t = raw.trim();
      if (ARTIGO_TAG_RE.test(t)) break;
      if (TOP_HEADING_RE.test(raw)) break;
      if (DOCUMENT_NOTE_TAG_RE.test(t)) break;

      // Headings de seção (## TITULO_*, ## CAPITULO_*, ...) tipicamente
      // aparecem entre dois [ARTIGO:...]. NÃO fazem parte do texto do
      // artigo — fecha qualquer inner aberto e ignora silenciosamente.
      if (SUB_HEADING_RE.test(raw)) {
        flushInner();
        p++;
        continue;
      }

      const incM = INCISO_TAG_RE.exec(t);
      if (incM) {
        flushInner();
        const rawId = incM[1] ?? "";
        currentInner = {
          kind: "INCISO",
          rawId,
          label: inscisoLabel(rawId),
          text: "",
        };
        p++;
        continue;
      }
      const parM = PARAGRAFO_TAG_RE.exec(t);
      if (parM) {
        flushInner();
        const rawId = parM[1] ?? "";
        currentInner = {
          kind: "PARAGRAFO",
          rawId,
          label: paragrafoLabel(rawId),
          text: "",
        };
        p++;
        continue;
      }
      const aliM = ALINEA_TAG_RE.exec(t);
      if (aliM) {
        flushInner();
        const rawId = aliM[1] ?? "";
        currentInner = {
          kind: "ALINEA",
          rawId,
          label: alineaLabel(rawId),
          text: "",
        };
        p++;
        continue;
      }

      // Texto normal. Ignora linhas em branco; agrega texto multi-linha.
      if (t === "") {
        p++;
        continue;
      }
      // Linha que começa com `[` mas não casa nenhuma tag — é suspeita.
      if (t.startsWith("[") && t.endsWith("]")) {
        const msg = `Tag não reconhecida em [ARTIGO:${number}] (linha ${p + 1}): ${t}`;
        errors.push({ line: p + 1, message: msg });
        if (strict) throw new Error(msg);
        p++;
        continue;
      }
      appendText(t);
      p++;
    }
    flushInner();

    i = p; // posição depois do último consumo
    const fullPath = humanizeHierarchy(meta.hierarquia, ref);

    const segment: SemanticSegment =
      meta.codigo.toUpperCase() === "ADCT" || topLevel === "ADCT" ? "ADCT" : "MAIN";

    const text = buildArticleText(segment, fullPath, ref, caput, internals);

    const article: ParsedSemanticArticle = {
      segment,
      number,
      numberInt: Number.isFinite(numberInt) ? numberInt : 0,
      ...(suffix ? { suffix } : {}),
      ref,
      meta,
      caput,
      internals,
      fullPath,
      text,
    };
    return article;
  };

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const t = raw.trim();

    // Top-level heading.
    const top = TOP_HEADING_RE.exec(raw);
    if (top) {
      const heading = (top[1] ?? "").trim().toUpperCase();
      if (heading === "ADCT") {
        topLevel = "ADCT";
      } else {
        topLevel = "MAIN";
        title = "Constituição Federal";
      }
      // Reset preamble on new top-level.
      inPreambleCollect = topLevel === "MAIN";
      preambleBuf.length = 0;
      i++;
      continue;
    }

    // Sub-heading hierárquico (## TITULO_*, etc) — encerra preamble.
    if (SUB_HEADING_RE.test(raw)) {
      if (inPreambleCollect && preambleBuf.length > 0 && !preamble) {
        preamble = preambleBuf.join("\n").trim();
      }
      inPreambleCollect = false;
      i++;
      continue;
    }

    // Document note (assinaturas etc) — coleta como nota, não vira chunk.
    if (DOCUMENT_NOTE_TAG_RE.test(t)) {
      // Lê linhas até próximo [ARTIGO:], top-level ou EOF.
      i++;
      const buf: string[] = [];
      while (i < lines.length) {
        const r = (lines[i] ?? "").trim();
        if (
          ARTIGO_TAG_RE.test(r) ||
          TOP_HEADING_RE.test(lines[i] ?? "") ||
          SUB_HEADING_RE.test(lines[i] ?? "")
        )
          break;
        // Outro [DOCUMENT_NOTE]?
        if (DOCUMENT_NOTE_TAG_RE.test(r)) {
          // Próxima nota — descarta a nota anterior fechada e abre nova.
          if (buf.length) documentNotes.push({ text: buf.join("\n").trim() });
          buf.length = 0;
          i++;
          continue;
        }
        if (r) buf.push(r);
        i++;
      }
      if (buf.length) documentNotes.push({ text: buf.join("\n").trim() });
      continue;
    }

    // Início de artigo.
    if (ARTIGO_TAG_RE.test(t)) {
      if (inPreambleCollect && preambleBuf.length > 0 && !preamble) {
        preamble = preambleBuf.join("\n").trim();
      }
      inPreambleCollect = false;
      const article = consumeArticle(t, i);
      if (article) articles.push(article);
      // i já foi atualizado em consumeArticle.
      continue;
    }

    // Tag órfã (fora de artigo)?
    if (
      t.startsWith("[") &&
      t.endsWith("]") &&
      isStructuralTagLine(t) &&
      !DOCUMENT_NOTE_TAG_RE.test(t)
    ) {
      const msg = `Tag fora de [ARTIGO:...] (linha ${i + 1}): ${t}`;
      errors.push({ line: i + 1, message: msg });
      if (strict) throw new Error(msg);
      i++;
      continue;
    }

    // Texto livre.
    if (t === "") {
      i++;
      continue;
    }
    if (PREAMBLE_KEYWORD_RE.test(raw) || inPreambleCollect) {
      if (!PREAMBLE_KEYWORD_RE.test(raw)) preambleBuf.push(t);
    }
    i++;
  }

  if (inPreambleCollect && preambleBuf.length > 0 && !preamble) {
    preamble = preambleBuf.join("\n").trim();
  }

  const main = articles.filter((a) => a.segment === "MAIN");
  const adct = articles.filter((a) => a.segment === "ADCT");

  let incisos = 0;
  let paragrafos = 0;
  let alineas = 0;
  for (const a of articles) {
    for (const inner of a.internals) {
      if (inner.kind === "INCISO") incisos++;
      else if (inner.kind === "PARAGRAFO") paragrafos++;
      else if (inner.kind === "ALINEA") alineas++;
    }
  }

  // Em strict, falha se houver erros não-recuperáveis. Aqui só logs.
  if (errors.length > 0 && strict) {
    // O parser propaga via throw acima; este fallback nunca dispara em strict.
  }

  return {
    title,
    ...(preamble ? { preamble } : {}),
    articles,
    segments: { MAIN: main, ADCT: adct },
    documentNotes,
    stats: {
      articlesMain: main.length,
      articlesAdct: adct.length,
      incisos,
      paragrafos,
      alineas,
      documentNotes: documentNotes.length,
      bytes: Buffer.byteLength(md, "utf8"),
    },
    errors,
  };
}

/** Validação leve para auditoria: apenas conta + reporta gaps/anomalias. */
export type CfSemanticValidationReport = {
  ok: boolean;
  stats: CfSemanticParseStats;
  segments: { MAIN: number; ADCT: number };
  gapsMain: number[];
  gapsAdct: number[];
  duplicatesMain: string[];
  duplicatesAdct: string[];
  articlesWithoutMeta: number;
  documentNotes: number;
  hierarchyMissing: string[];
  errors: CfSemanticParseError[];
};

export function validateCfSemantic(md: string): CfSemanticValidationReport {
  let parsed: ParsedCfSemantic;
  const parseErrors: CfSemanticParseError[] = [];
  try {
    parsed = parseConstitutionSemantic(md, { strict: false });
    parseErrors.push(...parsed.errors);
  } catch (err) {
    parseErrors.push({ line: 0, message: (err as Error).message });
    parsed = {
      title: "",
      articles: [],
      segments: { MAIN: [], ADCT: [] },
      documentNotes: [],
      stats: {
        articlesMain: 0,
        articlesAdct: 0,
        incisos: 0,
        paragrafos: 0,
        alineas: 0,
        documentNotes: 0,
        bytes: Buffer.byteLength(md, "utf8"),
      },
      errors: [],
    };
  }

  const gaps = (arts: ParsedSemanticArticle[]): number[] => {
    const numericOnly = arts.filter((a) => !a.suffix).map((a) => a.numberInt);
    if (numericOnly.length === 0) return [];
    const min = Math.min(...numericOnly);
    const max = Math.max(...numericOnly);
    const set = new Set(numericOnly);
    const gaps: number[] = [];
    for (let n = min; n <= max; n++) if (!set.has(n)) gaps.push(n);
    return gaps;
  };

  const duplicates = (arts: ParsedSemanticArticle[]): string[] => {
    const seen = new Map<string, number>();
    for (const a of arts) seen.set(a.number, (seen.get(a.number) ?? 0) + 1);
    return [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  };

  const articlesWithoutMeta = parsed.articles.filter(
    (a) => !a.meta.codigo || !a.meta.hierarquia,
  ).length;
  const hierarchyMissing = parsed.articles
    .filter((a) => !a.meta.hierarquia)
    .map((a) => `${a.meta.codigo || "?"}:${a.number}`);

  return {
    ok: parseErrors.length === 0 && articlesWithoutMeta === 0,
    stats: parsed.stats,
    segments: { MAIN: parsed.segments.MAIN.length, ADCT: parsed.segments.ADCT.length },
    gapsMain: gaps(parsed.segments.MAIN),
    gapsAdct: gaps(parsed.segments.ADCT),
    duplicatesMain: duplicates(parsed.segments.MAIN),
    duplicatesAdct: duplicates(parsed.segments.ADCT),
    articlesWithoutMeta,
    documentNotes: parsed.documentNotes.length,
    hierarchyMissing,
    errors: parseErrors,
  };
}
