// @ts-nocheck
/**
 * Normalização de markdown jurídico “plano” (Planalto / cópia simples) para o
 * formato semântico usado em `CONSTITUICAO.md`: `[ARTIGO]`, `[META]`, tags de
 * inciso/parágrafo etc.
 *
 * Origem: lógica extraída de `scripts/normalize-constitucao-md.ts` para reuso
 * em outras leis (ex.: Lei 8.245/1991).
 */

export type SemanticLegalNormalizeProfile = {
  documentH1: string;
  codigoMain: string;
  tipoMain: string;
  vigencia: string;
  includeAdct: boolean;
  codigoAdct?: string;
  tipoAdct?: string;
  /** Só linha 0 do input (legado CF). */
  skipFirstInputLineRe?: RegExp;
  documentNoteTriggers?: RegExp[];
};

type ContextKey = string;

type MacroKind = "LIVRO" | "TITULO" | "CAPITULO" | "SECAO" | "SUBSECAO" | "PARTE" | "ATO";

type MacroState = Partial<
  Record<
    MacroKind,
    {
      key: string;
      name: string;
    }
  >
>;

type DocSegment = "CF" | "ADCT" | "MAIN";

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function toUpperSnake(input: string): string {
  const cleaned = stripDiacritics(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return cleaned;
}

function normalizeNameForMeta(input: string): string {
  const tokens = toUpperSnake(input)
    .split("_")
    .filter(Boolean)
    .filter((t) => !["DO", "DA", "DOS", "DAS", "DE", "E", "A", "O", "AS", "OS", "EM", "NO", "NA", "NOS", "NAS"].includes(t));
  return tokens.join("_");
}

function computeTemaFromTituloName(tituloName?: string): string {
  if (!tituloName) return "geral";
  const snake = normalizeNameForMeta(tituloName).toLowerCase();
  return snake.length > 48 ? snake.slice(0, 48) : snake;
}

function isTopHeading(line: string): { level: 1 | 2; text: string } | null {
  const m = line.match(/^(#{1,2})\s+(.+?)\s*$/);
  if (!m) return null;
  const level = m[1].length as 1 | 2;
  return { level, text: m[2] };
}

function shouldDropLine(line: string): boolean {
  return /\brevogad[oa]\b/i.test(line);
}

function cleanupVisualMarkdown(line: string): string {
  let out = line;
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  // Não tratar pares `_…_` como itálico em hierarquias snake (TITULO_I>…),
  // nem em linhas chave=valor (ex.: hierarquia=…), nem tokens LEI_8245_INQUILINATO
  // (senão `_8245_` vira itálico e some o underscore).
  const t = out.trim();
  const looksSnakeOrMetaKv =
    /^[a-zA-Z][\w]*\s*=/.test(t) ||
    />[A-Z0-9_]+(?:>[A-Z0-9_]+)*/.test(out) ||
    /^[A-Z][A-Z0-9_]*(>[A-Z0-9_]+)*$/i.test(t);
  if (!looksSnakeOrMetaKv) {
    out = out.replace(/_(.+?)_/g, "$1");
  }
  out = out.replace(/\s+$/g, "");
  return out;
}

function normalizeMacroHeading(line: string): string {
  const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!m) return line;
  const level = m[1].length;
  let text = m[2];
  text = text.replace(/\s*:\s*/g, " - ");
  if (level === 1) return `# ${text.toUpperCase()}`;
  return `## ${text.toUpperCase()}`;
}

/** Headings já normalizados, ex.: `TITULO_I`, `CAPITULO_II`. */
function parseSnakeMacroKey(text: string): { kind: MacroKind; key: string; name: string; outHeading: string } | null {
  const m = text.match(/^(LIVRO|TITULO|CAPITULO|SECAO|SUBSECAO|PARTE)_((?:[IVXLCDM]+)|UNICO)$/iu);
  if (!m) return null;
  const kindWord = stripDiacritics(m[1]).toUpperCase();
  const roman = m[2].toUpperCase();
  const kind = kindWord as MacroKind;
  const key = `${kind}_${roman}`;
  return { kind, key, name: "", outHeading: `## ${key}` };
}

function parseMacroHeading(line: string): { kind: MacroKind; key: string; name: string; outHeading: string } | null {
  const raw = line.replace(/^#{1,6}\s+/, "").trim();
  const snake = parseSnakeMacroKey(raw);
  if (snake) return snake;

  const cleaned = raw.replace(/\s*:\s*/g, " - ").replace(/\s+/g, " ");

  if (/^ato\b/i.test(cleaned)) {
    const name = cleaned.replace(/^ato\b\s*-?\s*/i, "").trim() || cleaned;
    const outHeading = "## ATO";
    return { kind: "ATO", key: "ATO", name, outHeading };
  }

  const ascii = stripDiacritics(cleaned);
  const m = ascii.match(/^(LIVRO|TITULO|CAPITULO|SECAO|SUBSECAO|PARTE)\s+((?:[IVXLCDM]+)|UNICO)\s*(.*)$/i);
  if (!m) return null;

  const kindWord = m[1].toUpperCase();
  const romanRaw = m[2].toUpperCase();
  const roman = romanRaw === "UNICO" ? "UNICO" : romanRaw;
  const name = (m[3] ?? "").trim();

  const kind = kindWord as MacroKind;
  const key = `${kind}_${roman}`;
  const outHeading = `## ${key}`;
  return { kind, key, name, outHeading };
}

function parseMacroHeadingFromPlainLine(line: string): { kind: MacroKind; key: string; name: string; outHeading: string } | null {
  const headStripped = line.replace(/^#{1,6}\s+/, "").trim();
  const cleaned = headStripped.replace(/\s*:\s*/g, " - ").replace(/\s+/g, " ");
  if (!cleaned) return null;

  const snake = parseSnakeMacroKey(cleaned);
  if (snake) return snake;

  if (/^ato\b/i.test(cleaned)) {
    const name = cleaned.replace(/^ato\b\s*-?\s*/i, "").trim() || cleaned;
    return { kind: "ATO", key: "ATO", name, outHeading: "## ATO" };
  }

  const ascii = stripDiacritics(cleaned);
  const m = ascii.match(/^(LIVRO|TITULO|CAPITULO|SECAO|SUBSECAO|PARTE)\s+((?:[IVXLCDM]+)|UNICO)\s*(.*)$/i);
  if (!m) return null;
  const kindWord = m[1].toUpperCase();
  const romanRaw = m[2].toUpperCase();
  const roman = romanRaw === "UNICO" ? "UNICO" : romanRaw;
  const name = (m[3] ?? "").trim();
  const kind = kindWord as MacroKind;
  const key = `${kind}_${roman}`;
  return { kind, key, name, outHeading: `## ${key}` };
}

export function isLooseLegalHeadingLine(line: string): boolean {
  return /^(T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O)\b/.test(line.trim());
}

/** Ex.: `2.032` → `2032` para tags `[ARTIGO:…]` compatíveis com dígitos contínuos. */
function flattenBrazilLegalArticleRef(raw: string): string {
  const t = raw.trim().toUpperCase();
  const hy = t.match(/^([\d.]+)(-[A-Z])$/);
  const body = hy ? hy[1] : t;
  const sfx = hy ? hy[2] : "";
  if (/^\d{1,3}(?:\.\d{3})+$/.test(body)) {
    return body.replace(/\./g, "") + sfx;
  }
  return t;
}

function parseArticleLine(line: string): { id: string; text: string } | null {
  const m = line.match(
    /^\s*(?:#{1,6}\s+)?Art\.?\s*((?:\d{1,3})(?:\.\d{3})+(?:-[A-Za-z])?|\d+(?:-[A-Za-z])?|\d+[A-Za-z])\s*[º°]?\s*\.?\s*(.*)$/i,
  );
  if (!m) return null;
  const id = flattenBrazilLegalArticleRef(m[1]);
  const text = (m[2] ?? "").trim();
  return { id, text };
}

function parseParagraphSymbolLine(line: string): { id: string; text: string } | null {
  const m = line.match(/^\s*(?:#{1,6}\s+)?§\s*([0-9]+)\s*[º°]?\s*\.?\s*(.*)$/i);
  if (!m) return null;
  const id = m[1].trim();
  const text = (m[2] ?? "").trim();
  return { id, text };
}

function parseParagraphUnicoLine(line: string): { id: "UNICO"; text: string } | null {
  const m = line.match(/^\s*Par[aá]grafo\s+único\s*\.?\s*(.*)$/i);
  if (!m) return null;
  const text = (m[1] ?? "").trim();
  return { id: "UNICO", text };
}

function parseIncisoLine(line: string): { id: string; text: string } | null {
  const m = line.match(/^\s*(?:[-•]\s*)?([IVXLCDM]+)\s*-\s*(.+?)\s*$/);
  if (!m) return null;
  return { id: m[1].trim().toUpperCase(), text: m[2].trim() };
}

function parseAlineaLine(line: string): { id: string; text: string } | null {
  const m = line.match(/^\s*([a-z])\)\s*-?\s*(.+?)\s*$/i);
  if (!m) return null;
  return { id: m[1].toLowerCase(), text: m[2].trim() };
}

function parseItemLine(line: string): { id: string; text: string } | null {
  const m = line.match(/^\s*(\d+)\s*(?:[-)]\s*)(.+?)\s*$/);
  if (!m) return null;
  return { id: m[1], text: m[2].trim() };
}

function compactBlankLines(lines: string[]): string[] {
  const out: string[] = [];
  let prevBlank = false;
  for (const l of lines) {
    const blank = l.trim().length === 0;
    if (blank) {
      if (!prevBlank) out.push("");
      prevBlank = true;
      continue;
    }
    out.push(l);
    prevBlank = false;
  }
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  return out;
}

function isMacroDivisionHeading(line: string): boolean {
  const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
  if (!m) return false;
  const text = m[1].trim();
  if (/^(t[ií]tulo|cap[ií]tulo|se[cç][aã]o|subse[cç][aã]o|parte|livro|ato\b)/i.test(text)) return true;
  return /^(LIVRO|TITULO|CAPITULO|SECAO|SUBSECAO|PARTE)_((?:[IVXLCDM]+)|UNICO)$/iu.test(text);
}

/**
 * Converte markdown legado da norma para o formato semântico ([ARTIGO]/[META]/…).
 */
export function normalizeSemanticLegalMd(input: string, profile: SemanticLegalNormalizeProfile): string {
  const lines = input.split(/\r?\n/);

  let _currentContext: ContextKey = "__root__";
  let macroState: MacroState = {};
  let docSegment: DocSegment = profile.includeAdct ? "CF" : "MAIN";

  const articleLastIndex = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const cleaned = cleanupVisualMarkdown(lines[i]);
    const parsedMacro =
      (/^#{1,6}\s+/.test(cleaned) && isMacroDivisionHeading(cleaned) ? parseMacroHeading(cleaned) : null) ??
      parseMacroHeadingFromPlainLine(cleaned);

    if (parsedMacro?.kind === "ATO") {
      if (profile.includeAdct) {
        docSegment = "ADCT";
        _currentContext = "2:ATO";
        macroState = {};
      }
      continue;
    }

    if (profile.includeAdct && cleaned.trim() === "# ADCT") {
      docSegment = "ADCT";
      macroState = {};
      continue;
    }

    if (/^#{1,6}\s+/.test(cleaned) && isMacroDivisionHeading(cleaned)) {
      const parsed = parseMacroHeading(cleaned);
      const normalized = normalizeMacroHeading(cleaned);
      const top = isTopHeading(normalized);
      if (top) _currentContext = `${top.level}:${top.text}`;
      if (parsed) {
        macroState[parsed.kind] = { key: parsed.key, name: parsed.name };
      }
    } else {
      const top = isTopHeading(cleaned);
      if (top) _currentContext = `${top.level}:${top.text}`;
    }

    const art = parseArticleLine(cleaned);
    if (!art) continue;

    const key = `${docSegment}::${art.id}`;
    articleLastIndex.set(key, i);
  }

  const out: string[] = [profile.documentH1, ""];
  _currentContext = "__root__";
  macroState = {};
  let root: DocSegment = profile.includeAdct ? "CF" : "MAIN";

  const slugPlain0 = profile.documentH1.replace(/^#\s*/, "").trim();
  const slugCollapsed0 =
    slugPlain0.includes("_") ? slugPlain0.replace(/_/g, "") : "";

  let i = 0;
  while (i < lines.length) {
    let line = cleanupVisualMarkdown(lines[i]);
    if (line.trim() === profile.documentH1.trim()) {
      i++;
      continue;
    }
    if (line.trim() === slugPlain0) {
      i++;
      continue;
    }
    if (slugCollapsed0 && line.trim() === slugCollapsed0) {
      i++;
      continue;
    }
    if (profile.includeAdct && line.trim() === "# ADCT") {
      root = "ADCT";
      macroState = {};
      const dupAdct =
        out.length >= 2 && out[out.length - 2] === "# ADCT" && out[out.length - 1] === "";
      if (!dupAdct) {
        out.push("# ADCT");
        out.push("");
      }
      i++;
      continue;
    }
    if (i === 0 && profile.skipFirstInputLineRe?.test(line.trim())) {
      i++;
      continue;
    }
    if (shouldDropLine(line)) {
      i++;
      continue;
    }

    const parsedMacro =
      (/^#{1,6}\s+/.test(line) && isMacroDivisionHeading(line) ? parseMacroHeading(line) : null) ??
      parseMacroHeadingFromPlainLine(line);

    if (parsedMacro && parsedMacro.kind === "ATO") {
      if (!profile.includeAdct) {
        i++;
        continue;
      }
      root = "ADCT";
      macroState = {};
      out.push("# ADCT");
      out.push("");
      i++;
      continue;
    }

    if (parsedMacro) {
      const normalized = normalizeMacroHeading(line);
      const top = isTopHeading(normalized);
      if (top) _currentContext = `${top.level}:${top.text}`;

      const parsed = parsedMacro;
      if (parsed) {
        macroState[parsed.kind] = { key: parsed.key, name: parsed.name };

        const resetOrder: MacroKind[] = ["LIVRO", "TITULO", "CAPITULO", "SECAO", "SUBSECAO"];
        const idx = resetOrder.indexOf(parsed.kind);
        if (idx >= 0) {
          for (const lower of resetOrder.slice(idx + 1)) delete macroState[lower];
        }

        out.push(parsed.outHeading);
        out.push("");
      } else {
        const text = normalized.replace(/^#{1,2}\s+/, "");
        out.push(`## ${toUpperSnake(text)}`);
        out.push("");
      }
      i++;
      continue;
    }

    const top = isTopHeading(line);
    if (top) _currentContext = `${top.level}:${top.text}`;

    if (/^#{1,6}\s+/.test(line) && !isMacroDivisionHeading(line)) {
      line = line.replace(/^#{1,6}\s+/, "");
    }

    const art = parseArticleLine(line);
    if (!art) {
      const pSym = parseParagraphSymbolLine(line);
      if (pSym) {
        out.push(`[PARAGRAFO:${pSym.id}]`);
        if (pSym.text) out.push(pSym.text);
        out.push("");
        i++;
        continue;
      }

      const pUnico = parseParagraphUnicoLine(line);
      if (pUnico) {
        out.push(`[PARAGRAFO:${pUnico.id}]`);
        if (pUnico.text) out.push(pUnico.text);
        out.push("");
        i++;
        continue;
      }

      const inciso = parseIncisoLine(line);
      if (inciso) {
        out.push(`[INCISO:${inciso.id}]`);
        out.push(inciso.text);
        out.push("");
        i++;
        continue;
      }

      const alinea = parseAlineaLine(line);
      if (alinea) {
        out.push(`[ALINEA:${alinea.id}]`);
        out.push(alinea.text);
        out.push("");
        i++;
        continue;
      }

      const item = parseItemLine(line);
      if (item) {
        out.push(`[ITEM:${item.id}]`);
        out.push(item.text);
        out.push("");
        i++;
        continue;
      }

      if (line.trim().length > 0) out.push(line);
      else out.push("");
      i++;
      continue;
    }

    const artKey = `${root}::${art.id}`;
    const keepThisArticle = articleLastIndex.get(artKey) === i;

    let j = i + 1;
    for (; j < lines.length; j++) {
      const candidate = cleanupVisualMarkdown(lines[j]);
      if (
        (/^#{1,6}\s+/.test(candidate) && isMacroDivisionHeading(candidate)) ||
        parseMacroHeadingFromPlainLine(candidate)
      ) {
        break;
      }
      if (parseArticleLine(candidate)) break;
    }

    if (!keepThisArticle) {
      i = j;
      continue;
    }

    out.push(`[ARTIGO:${art.id}]`);
    const titulo = macroState.TITULO;
    const parts: string[] = [];
    const order: MacroKind[] = ["LIVRO", "TITULO", "CAPITULO", "SECAO", "SUBSECAO"];
    for (const kind of order) {
      const v = macroState[kind];
      if (!v) continue;
      const name = v.name ? normalizeNameForMeta(v.name) : "";
      if (name) parts.push(`${v.key}>${name}`);
      else parts.push(v.key);
    }

    const hierarquia = parts.join(">");
    const tema = computeTemaFromTituloName(titulo?.name);

    out.push("[META]");
    if (root === "ADCT") {
      out.push(`codigo=${profile.codigoAdct ?? "ADCT"}`);
      out.push(`tipo=${profile.tipoAdct ?? "ATO_DAS_DISPOSICOES_CONSTITUCIONAIS_TRANSITORIAS"}`);
      out.push(`hierarquia=ADCT${hierarquia ? ">" + hierarquia : ""}`);
      out.push("tema=adct");
    } else {
      out.push(`codigo=${profile.codigoMain}`);
      out.push(`tipo=${profile.tipoMain}`);
      if (hierarquia) out.push(`hierarquia=${hierarquia}`);
      out.push(`tema=${tema}`);
    }
    out.push(`artigo=${art.id}`);
    out.push(`vigencia=${profile.vigencia}`);
    out.push("[/META]");
    out.push("");

    if (art.text) out.push(art.text);
    out.push("");

    const paragraphLastIndex = new Map<string, number>();
    for (let k = i + 1; k < j; k++) {
      const cleanedK = cleanupVisualMarkdown(lines[k]);
      const pSym = parseParagraphSymbolLine(cleanedK);
      if (pSym) paragraphLastIndex.set(pSym.id, k);
      const pUnico = parseParagraphUnicoLine(cleanedK);
      if (pUnico) paragraphLastIndex.set(pUnico.id, k);
    }

    for (let k = i + 1; k < j; k++) {
      const cleanedK = cleanupVisualMarkdown(lines[k]);
      if (shouldDropLine(cleanedK)) continue;

      const pSym = parseParagraphSymbolLine(cleanedK);
      if (pSym) {
        if (paragraphLastIndex.get(pSym.id) !== k) continue;
        out.push(`[PARAGRAFO:${pSym.id}]`);
        if (pSym.text) out.push(pSym.text);
        out.push("");
        continue;
      }

      const pUnico = parseParagraphUnicoLine(cleanedK);
      if (pUnico) {
        if (paragraphLastIndex.get(pUnico.id) !== k) continue;
        out.push(`[PARAGRAFO:${pUnico.id}]`);
        if (pUnico.text) out.push(pUnico.text);
        out.push("");
        continue;
      }

      const inciso = parseIncisoLine(cleanedK);
      if (inciso) {
        out.push(`[INCISO:${inciso.id}]`);
        out.push(inciso.text);
        out.push("");
        continue;
      }

      const alinea = parseAlineaLine(cleanedK);
      if (alinea) {
        out.push(`[ALINEA:${alinea.id}]`);
        out.push(alinea.text);
        out.push("");
        continue;
      }

      const item = parseItemLine(cleanedK);
      if (item) {
        out.push(`[ITEM:${item.id}]`);
        out.push(item.text);
        out.push("");
        continue;
      }

      const trimmed = cleanedK.trim();
      if (trimmed.length === 0) {
        out.push("");
        continue;
      }
      out.push(trimmed);
    }

    i = j;
  }

  const outSanitized =
    slugCollapsed0.length > 0
      ? out.filter((row) => row.trim() !== slugCollapsed0)
      : out;

  const fixed: string[] = [];
  for (let idx = 0; idx < outSanitized.length; idx++) {
    const cur = outSanitized[idx];
    const next = outSanitized[idx + 1];

    const incisoTok = cur.match(/^\[INCISO:([IVXLCDM]+)\]$/);
    const incisoCompound = next?.match(/^([A-Z])\s*-\s*(.+)$/);
    if (incisoTok && incisoCompound) {
      fixed.push(`[INCISO:${incisoTok[1]}-${incisoCompound[1]}]`);
      fixed.push(incisoCompound[2]);
      idx++;
      continue;
    }

    const parTok = cur.match(/^\[PARAGRAFO:(\d+)\]$/);
    const parCompound = next?.match(/^-([A-Z])\.\s*(.+)$/);
    if (parTok && parCompound) {
      fixed.push(`[PARAGRAFO:${parTok[1]}-${parCompound[1]}]`);
      fixed.push(parCompound[2]);
      idx++;
      continue;
    }

    fixed.push(cur);
  }

  const compacted = compactBlankLines(fixed);
  const triggers = profile.documentNoteTriggers ?? [];
  if (triggers.length === 0) {
    return compacted.join("\n");
  }
  if (input.includes("[DOCUMENT_NOTE]")) {
    return compacted.join("\n");
  }

  let noteStart = -1;
  for (let idx = 0; idx < compacted.length; idx++) {
    const l = compacted[idx].trim();
    if (!l) continue;
    if (triggers.some((r) => r.test(l))) {
      noteStart = idx;
      break;
    }
  }
  if (noteStart >= 0) {
    const head = compacted.slice(0, noteStart);
    const tail = compacted.slice(noteStart);
    return compactBlankLines([
      ...head,
      "",
      "[DOCUMENT_NOTE]",
      ...tail,
      "[/DOCUMENT_NOTE]",
    ]).join("\n");
  }

  return compacted.join("\n");
}

export const PROFILE_CONSTITUICAO_FEDERAL: SemanticLegalNormalizeProfile = {
  documentH1: "# CONSTITUICAO_FEDERAL",
  codigoMain: "CF",
  tipoMain: "CONSTITUICAO",
  vigencia: "1988",
  includeAdct: true,
  codigoAdct: "ADCT",
  tipoAdct: "ATO_DAS_DISPOSICOES_CONSTITUCIONAIS_TRANSITORIAS",
  skipFirstInputLineRe: /constitui[cç][aã]o\s+da\s+rep[úu]blica/i,
  documentNoteTriggers: [
    /^bras[ií]lia,\s*5\s+de\s+outubro\s+de\s+1988\./i,
    /^participantes\b/i,
    /^in\s+memoriam\b/i,
  ],
};

export const PROFILE_LEI_8245_INQUILINATO: SemanticLegalNormalizeProfile = {
  documentH1: "# LEI_8245_INQUILINATO",
  codigoMain: "L8245",
  tipoMain: "LEI_INQUILINATO",
  vigencia: "1991",
  includeAdct: false,
  documentNoteTriggers: [],
};

/** Lei 10.406/2002 — Código Civil (markdown semântico alinhado à CF). */
export const PROFILE_CODIGO_CIVIL: SemanticLegalNormalizeProfile = {
  documentH1: "# CODIGO_CIVIL",
  codigoMain: "L10406",
  tipoMain: "CODIGO_CIVIL",
  vigencia: "2002",
  includeAdct: false,
  documentNoteTriggers: [],
};
