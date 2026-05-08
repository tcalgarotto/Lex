// @ts-nocheck
// Script one-shot que reformatou o `CONSTITUICAO.md` legado para o formato
// semântico ([ARTIGO:N] + [META]). Já foi executado e o markdown atual já
// nasceu nesse padrão; mantemos o arquivo apenas como histórico.
import { readFile, writeFile } from "node:fs/promises";

type ContextKey = string;

type MacroKind = "LIVRO" | "TITULO" | "CAPITULO" | "SECAO" | "SUBSECAO" | "PARTE" | "ATO";

type MacroState = Partial<
  Record<
    MacroKind,
    {
      key: string; // e.g. TITULO_II
      name: string; // e.g. DOS DIREITOS E GARANTIAS FUNDAMENTAIS
    }
  >
>;

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
  // Remove common Portuguese stop-words that add noise, keep deterministic.
  const tokens = toUpperSnake(input)
    .split("_")
    .filter(Boolean)
    .filter((t) => !["DO", "DA", "DOS", "DAS", "DE", "E", "A", "O", "AS", "OS", "EM", "NO", "NA", "NOS", "NAS"].includes(t));
  return tokens.join("_");
}

function computeTemaFromTituloName(tituloName?: string): string {
  if (!tituloName) return "geral";
  const snake = normalizeNameForMeta(tituloName).toLowerCase();
  // keep reasonably short
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
  // Remove visual markdown markers without changing semantics.
  // - bold/italic markers
  // - underline-like wrappers used for alíneas (e.g. "_a)_")
  let out = line;
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/_(.+?)_/g, "$1");
  out = out.replace(/\s+$/g, "");
  return out;
}

function normalizeMacroHeading(line: string): string {
  // Only allow:
  // - One H1 for the document
  // - H2 for all macro divisions (Título/Capítulo/Seção/Subseção/Parte/Livro/ADCT etc.)
  //
  // Any H3+ becomes H2, preserving text but uppercasing and making the separator explicit.
  const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!m) return line;
  const level = m[1].length;
  let text = m[2];

  // Normalize "X: Y" -> "X - Y" (explicit separator)
  text = text.replace(/\s*:\s*/g, " - ");

  if (level === 1) return `# ${text.toUpperCase()}`;
  return `## ${text.toUpperCase()}`;
}

function parseMacroHeading(line: string): { kind: MacroKind; key: string; name: string; outHeading: string } | null {
  // Accept "## Título II: Dos ..." and variants. We emit minimal headings:
  // "## TITULO_II" (and keep the descriptive name in state for META only).
  const raw = line.replace(/^#{1,6}\s+/, "").trim();
  const cleaned = raw.replace(/\s*:\s*/g, " - ").replace(/\s+/g, " ");

  // ATO (ADCT) has no numeral
  if (/^ato\b/i.test(cleaned)) {
    const name = cleaned.replace(/^ato\b\s*-?\s*/i, "").trim() || cleaned;
    const outHeading = "## ATO";
    return { kind: "ATO", key: "ATO", name, outHeading };
  }

  const m = cleaned.match(/^(livro|t[ií]tulo|cap[ií]tulo|se[cç][aã]o|subse[cç][aã]o|parte)\s+([IVXLCDM]+)\s*(?:-+\s*(.*))?$/i);
  if (!m) return null;

  const kindWord = stripDiacritics(m[1]).toUpperCase();
  const roman = m[2].toUpperCase();
  const name = (m[3] ?? "").trim();

  const kind = kindWord as MacroKind;
  const key = `${kind}_${roman}`;
  const outHeading = `## ${key}`;
  return { kind, key, name, outHeading };
}

function parseMacroHeadingFromPlainLine(line: string): { kind: MacroKind; key: string; name: string; outHeading: string } | null {
  // Same as parseMacroHeading, but for non-markdown lines like:
  // "CAPÍTULO IV: DA CIÊNCIA, TECNOLOGIA E INOVAÇÃO"
  const cleaned = line.trim().replace(/\s*:\s*/g, " - ").replace(/\s+/g, " ");
  if (!cleaned) return null;

  if (/^ato\b/i.test(cleaned)) {
    const name = cleaned.replace(/^ato\b\s*-?\s*/i, "").trim() || cleaned;
    return { kind: "ATO", key: "ATO", name, outHeading: "## ATO" };
  }

  const m = cleaned.match(/^(livro|t[ií]tulo|cap[ií]tulo|se[cç][aã]o|subse[cç][aã]o|parte)\s+([IVXLCDM]+)\s*(?:-+\s*(.*))?$/i);
  if (!m) return null;
  const kindWord = stripDiacritics(m[1]).toUpperCase();
  const roman = m[2].toUpperCase();
  const name = (m[3] ?? "").trim();
  const kind = kindWord as MacroKind;
  const key = `${kind}_${roman}`;
  return { kind, key, name, outHeading: `## ${key}` };
}

function isLooseLegalHeadingLine(line: string): boolean {
  // Must match the required regex given by user (but we keep it diacritic tolerant).
  return /^(T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O)\b/.test(line.trim());
}

function parseArticleLine(line: string): { id: string; text: string } | null {
  // Accept both current normalized form ("#### Art. 10. ...") and raw ("Art. 10. ...")
  // IMPORTANT: match only "Art." with capital A to avoid false positives like
  // "art. 84" references inside body lines.
  const m = line.match(/^\s*(?:#{1,6}\s+)?Art\.?\s*([0-9]+(?:-[A-Za-z])?|[0-9]+[A-Za-z])\s*[º°]?\s*\.?\s*(.*)$/);
  if (!m) return null;
  const id = m[1].trim().toUpperCase();
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
  // "Parágrafo único. Texto"
  const m = line.match(/^\s*Par[aá]grafo\s+único\s*\.?\s*(.*)$/i);
  if (!m) return null;
  const text = (m[1] ?? "").trim();
  return { id: "UNICO", text };
}

function parseIncisoLine(line: string): { id: string; text: string } | null {
  // "- I - texto" OR "I - texto"
  const m = line.match(/^\s*(?:[-•]\s*)?([IVXLCDM]+)\s*-\s*(.+?)\s*$/);
  if (!m) return null;
  return { id: m[1].trim().toUpperCase(), text: m[2].trim() };
}

function parseAlineaLine(line: string): { id: string; text: string } | null {
  // "a) texto" or "a) - texto"
  const m = line.match(/^\s*([a-z])\)\s*-?\s*(.+?)\s*$/i);
  if (!m) return null;
  return { id: m[1].toLowerCase(), text: m[2].trim() };
}

function parseItemLine(line: string): { id: string; text: string } | null {
  // "1 - texto" or "1) texto"
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
  // Avoid trailing blanks
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  return out;
}

function isMacroDivisionHeading(line: string): boolean {
  const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
  if (!m) return false;
  const text = m[1].trim();
  return /^(t[ií]tulo|cap[ií]tulo|se[cç][aã]o|subse[cç][aã]o|parte|livro|ato\b)/i.test(text);
}

function normalizeLines(input: string): string {
  const lines = input.split(/\r?\n/);

  // Track context using last H1/H2 only (keeps Constituição vs ADCT distinct).
  let currentContext: ContextKey = "__root__";
  let macroState: MacroState = {};
  let rootFirstPass: "CF" | "ADCT" = "CF";

  const articleLastIndex = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const cleaned = cleanupVisualMarkdown(lines[i]);
    const parsedMacro =
      (/^#{1,6}\s+/.test(cleaned) && isMacroDivisionHeading(cleaned) ? parseMacroHeading(cleaned) : null) ??
      parseMacroHeadingFromPlainLine(cleaned);

    if (parsedMacro?.kind === "ATO") {
      rootFirstPass = "ADCT";
      currentContext = "2:ATO";
      macroState = {};
      continue;
    }

    if (/^#{1,6}\s+/.test(cleaned) && isMacroDivisionHeading(cleaned)) {
      const parsed = parseMacroHeading(cleaned);
      const normalized = normalizeMacroHeading(cleaned);
      const top = isTopHeading(normalized);
      if (top) currentContext = `${top.level}:${top.text}`;
      if (parsed) {
        macroState[parsed.kind] = { key: parsed.key, name: parsed.name };
      }
    } else {
      const top = isTopHeading(cleaned);
      if (top) currentContext = `${top.level}:${top.text}`;
    }

    const art = parseArticleLine(cleaned);
    if (!art) continue;

    const key = `${rootFirstPass}::${art.id}`;
    articleLastIndex.set(key, i);
  }

  // Second pass: emit fully semantic format (tokens), skipping non-last article blocks.
  const out: string[] = ["# CONSTITUICAO_FEDERAL", ""];
  currentContext = "__root__";
  macroState = {};
  let root: "CF" | "ADCT" = "CF";

  let i = 0;
  while (i < lines.length) {
    let line = cleanupVisualMarkdown(lines[i]);
    // Drop the original document title line if present (we inject a canonical H1 above).
    if (i === 0 && /constitui[cç][aã]o\s+da\s+rep[úu]blica/i.test(line.trim())) {
      i++;
      continue;
    }
    if (shouldDropLine(line)) {
      i++;
      continue;
    }

    // Normalize macro headings from either markdown headings or plain lines.
    const parsedMacro =
      (/^#{1,6}\s+/.test(line) && isMacroDivisionHeading(line) ? parseMacroHeading(line) : null) ??
      parseMacroHeadingFromPlainLine(line);

    if (parsedMacro && parsedMacro.kind === "ATO") {
      // Split ADCT into its own root (mandatory).
      root = "ADCT";
      macroState = {};
      out.push("# ADCT");
      out.push("");
      i++;
      continue;
    }

    // Headings: only keep if they are macro divisions; never for Artigo/§ etc.
    if (parsedMacro) {
      const normalized = normalizeMacroHeading(line);
      const top = isTopHeading(normalized);
      if (top) currentContext = `${top.level}:${top.text}`;

      const parsed = parsedMacro;
      if (parsed) {
        // Update hierarchy state
        macroState[parsed.kind] = { key: parsed.key, name: parsed.name };

        // Reset lower levels deterministically
        const resetOrder: MacroKind[] = ["LIVRO", "TITULO", "CAPITULO", "SECAO", "SUBSECAO"];
        const idx = resetOrder.indexOf(parsed.kind);
        if (idx >= 0) {
          for (const lower of resetOrder.slice(idx + 1)) delete macroState[lower];
        }

        // Emit minimal macro heading
        out.push(parsed.outHeading);
        out.push("");
      } else {
        // Fallback: keep as H2 but normalized, snake-cased (still macro-ish)
        const text = normalized.replace(/^#{1,2}\s+/, "");
        out.push(`## ${toUpperSnake(text)}`);
        out.push("");
      }
      i++;
      continue;
    }

    const top = isTopHeading(line);
    if (top) currentContext = `${top.level}:${top.text}`;

    // If a heading line is not a macro division, treat it as plain text (after stripping '#').
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

    // Find end of this article block: next article OR next macro division heading.
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

    // Emit article token + caput text (if any)
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
    if (root === "CF") {
      out.push("codigo=CF");
      out.push("tipo=CONSTITUICAO");
      if (hierarquia) out.push(`hierarquia=${hierarquia}`);
      out.push(`tema=${tema}`);
    } else {
      out.push("codigo=ADCT");
      out.push("tipo=ATO_DAS_DISPOSICOES_CONSTITUCIONAIS_TRANSITORIAS");
      out.push(`hierarquia=ADCT${hierarquia ? ">" + hierarquia : ""}`);
      out.push("tema=adct");
    }
    out.push(`artigo=${art.id}`);
    out.push("vigencia=1988");
    out.push("[/META]");
    out.push("");

    if (art.text) out.push(art.text);
    out.push("");

    // Inside article block, keep content but convert §/parágrafo/inciso/alínea/item to tokens.
    // Also dedupe § within this article by keeping only last occurrence of each.
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

  // Post-fixes: composed incisos and composed paragraphs.
  const fixed: string[] = [];
  for (let idx = 0; idx < out.length; idx++) {
    const cur = out[idx];
    const next = out[idx + 1];

    // [INCISO:I] + "A - texto" -> [INCISO:I-A] + "texto"
    const incisoTok = cur.match(/^\[INCISO:([IVXLCDM]+)\]$/);
    const incisoCompound = next?.match(/^([A-Z])\s*-\s*(.+)$/);
    if (incisoTok && incisoCompound) {
      fixed.push(`[INCISO:${incisoTok[1]}-${incisoCompound[1]}]`);
      fixed.push(incisoCompound[2]);
      idx++; // consume next
      continue;
    }

    // [PARAGRAFO:4] + "-C. texto" -> [PARAGRAFO:4-C] + "texto"
    const parTok = cur.match(/^\[PARAGRAFO:(\d+)\]$/);
    const parCompound = next?.match(/^-([A-Z])\.\s*(.+)$/);
    if (parTok && parCompound) {
      fixed.push(`[PARAGRAFO:${parTok[1]}-${parCompound[1]}]`);
      fixed.push(parCompound[2]);
      idx++; // consume next
      continue;
    }

    fixed.push(cur);
  }

  // Post-fix: non-normative tail (signatures / participants) after last ADCT article.
  // We wrap it in [DOCUMENT_NOTE] so it won't pollute embeddings.
  const compacted = compactBlankLines(fixed);
  const noteTriggers = [
    /^bras[ií]lia,\s*5\s+de\s+outubro\s+de\s+1988\./i,
    /^participantes\b/i,
    /^in\s+memoriam\b/i,
  ];
  let noteStart = -1;
  for (let idx = 0; idx < compacted.length; idx++) {
    const l = compacted[idx].trim();
    if (!l) continue;
    if (noteTriggers.some((r) => r.test(l))) {
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

function auditNormalized(normalized: string): {
  artigosTotal: number;
  artigosSemMeta: number;
  headingsInvalidos: number;
  incisosCompostosQuebrados: number;
  paragrafosCompostosQuebrados: number;
  artigosCompostosQuebrados: number;
  incisosCompostosCorrigidos: number;
  paragrafosCompostosCorrigidos: number;
  adctSeparado: boolean;
  incisosDuplicadosNoMesmoArtigo: number;
  legalHeadingsSoltos: number;
  artigosHierarquiaIncompativel: number;
  artigos218_219_fora_de_ciencia: number;
  conteudoNaoNormativoNoFim: boolean;
  statusParseavel: boolean;
} {
  const lines = normalized.split("\n");

  let artigosTotal = 0;
  let artigosSemMeta = 0;
  let headingsInvalidos = 0;
  let incisosCompostosQuebrados = 0;
  let paragrafosCompostosQuebrados = 0;
  let artigosCompostosQuebrados = 0;
  let incisosCompostosCorrigidos = 0;
  let paragrafosCompostosCorrigidos = 0;
  let adctSeparado = false;
  let incisosDuplicadosNoMesmoArtigo = 0;
  let legalHeadingsSoltos = 0;
  let artigosHierarquiaIncompativel = 0;
  let artigos218_219_fora_de_ciencia = 0;
  let conteudoNaoNormativoNoFim = false;

  const allowedH1 = new Set(["# CONSTITUICAO_FEDERAL", "# ADCT"]);
  const allowedH2Prefixes = ["## TITULO_", "## CAPITULO_", "## SECAO_", "## SUBSECAO_"];
  let currentArticle: string | null = null;
  let incisosSeen = new Set<string>();

  // Capture hierarquia per article for targeted checks.
  const metaByArticle = new Map<string, { hierarquia?: string; codigo?: string }>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      if (!allowedH1.has(line.trim())) headingsInvalidos++;
      if (line.trim() === "# ADCT") adctSeparado = true;
      continue;
    }

    if (line.startsWith("## ")) {
      const ok = allowedH2Prefixes.some((p) => line.startsWith(p));
      if (!ok) headingsInvalidos++;
      continue;
    }

    // Detect legal headings that appear as plain text (must be zero).
    if (!line.startsWith("#") && !line.startsWith("[") && isLooseLegalHeadingLine(line)) {
      legalHeadingsSoltos++;
    }

    const art = line.match(/^\[ARTIGO:([0-9]+(?:-[A-Z])?)\]$/);
    if (art) {
      artigosTotal++;
      currentArticle = art[1];
      incisosSeen = new Set();
      const next = lines[i + 1] ?? "";
      if (next.trim() !== "[META]") artigosSemMeta++;
      // Ensure composed article tokens are not broken (e.g. should be 29-A, not 29A)
      if (/^\d+[A-Z]$/.test(currentArticle)) artigosCompostosQuebrados++;

      // Parse META block for hierarquia if present.
      if ((lines[i + 1] ?? "").trim() === "[META]") {
        const meta: Record<string, string> = {};
        for (let j = i + 2; j < Math.min(i + 50, lines.length); j++) {
          const l = lines[j].trim();
          if (l === "[/META]") break;
          const eq = l.indexOf("=");
          if (eq > 0) meta[l.slice(0, eq)] = l.slice(eq + 1);
        }
        metaByArticle.set(currentArticle, { hierarquia: meta.hierarquia, codigo: meta.codigo });
      }
      continue;
    }

    const inciso = line.match(/^\[INCISO:([IVXLCDM]+)(?:-([A-Z]))?\]$/);
    if (inciso && currentArticle) {
      const key = inciso[0];
      if (incisosSeen.has(key)) incisosDuplicadosNoMesmoArtigo++;
      incisosSeen.add(key);

      // Broken composed inciso pattern: token without suffix but next line begins "A -"
      const next = lines[i + 1] ?? "";
      if (!inciso[2] && /^[A-Z]\s*-\s+/.test(next)) incisosCompostosQuebrados++;
      if (inciso[2]) incisosCompostosCorrigidos++;
      continue;
    }

    const par = line.match(/^\[PARAGRAFO:(\d+)(?:-([A-Z]))?\]$/);
    if (par) {
      const next = lines[i + 1] ?? "";
      if (!par[2] && /^-[A-Z]\.\s+/.test(next)) paragrafosCompostosQuebrados++;
      if (par[2]) paragrafosCompostosCorrigidos++;
      continue;
    }
  }

  // Targeted hierarchy checks for Art. 218, 219, 219-A
  for (const id of ["218", "219", "219-A"]) {
    const meta = metaByArticle.get(id);
    if (!meta?.hierarquia) {
      artigosHierarquiaIncompativel++;
      continue;
    }
    // Must not be under DESPORTO and should include CAPITULO_IV>CIENCIA_TECNOLOGIA_INOVACAO
    const h = meta.hierarquia;
    if (h.includes("DESPORTO")) artigos218_219_fora_de_ciencia++;
    if (!h.includes("CAPITULO_IV>CIENCIA_TECNOLOGIA_INOVACAO")) artigos218_219_fora_de_ciencia++;
  }

  // Detect non-normative tail: we expect it to be inside DOCUMENT_NOTE if present.
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "[DOCUMENT_NOTE]") {
      conteudoNaoNormativoNoFim = true;
      break;
    }
  }

  const statusParseavel =
    artigosSemMeta === 0 &&
    headingsInvalidos === 0 &&
    incisosCompostosQuebrados === 0 &&
    paragrafosCompostosQuebrados === 0 &&
    artigosCompostosQuebrados === 0 &&
    adctSeparado &&
    legalHeadingsSoltos === 0 &&
    artigos218_219_fora_de_ciencia === 0;

  return {
    artigosTotal,
    artigosSemMeta,
    headingsInvalidos,
    incisosCompostosQuebrados,
    paragrafosCompostosQuebrados,
    artigosCompostosQuebrados,
    incisosCompostosCorrigidos,
    paragrafosCompostosCorrigidos,
    adctSeparado,
    incisosDuplicadosNoMesmoArtigo,
    legalHeadingsSoltos,
    artigosHierarquiaIncompativel,
    artigos218_219_fora_de_ciencia,
    conteudoNaoNormativoNoFim,
    statusParseavel,
  };
}

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error("Usage: tsx scripts/normalize-constitucao-md.ts <path-to-md>");
    process.exit(2);
  }

  const original = await readFile(targetPath, "utf8");
  const normalized = normalizeLines(original);
  if (normalized === original) {
    console.log("No changes needed.");
    return;
  }

  await writeFile(targetPath, normalized, "utf8");
  console.log("Normalized:", targetPath);

  const report = auditNormalized(normalized);
  console.log(
    [
      "",
      "=== CONSTITUICAO.md RAG AUDIT ===",
      `artigos_total=${report.artigosTotal}`,
      `artigos_sem_meta=${report.artigosSemMeta}`,
      `headings_invalidos=${report.headingsInvalidos}`,
      `legal_headings_soltos=${report.legalHeadingsSoltos}`,
      `artigos_hierarquia_incompativel=${report.artigosHierarquiaIncompativel}`,
      `artigos_218_219_219A_fora_de_ciencia=${report.artigos218_219_fora_de_ciencia}`,
      `incisos_compostos_corrigidos=${report.incisosCompostosCorrigidos}`,
      `paragrafos_compostos_corrigidos=${report.paragrafosCompostosCorrigidos}`,
      `incisos_compostos_quebrados=${report.incisosCompostosQuebrados}`,
      `paragrafos_compostos_quebrados=${report.paragrafosCompostosQuebrados}`,
      `artigos_compostos_quebrados=${report.artigosCompostosQuebrados}`,
      `incisos_duplicados_no_mesmo_artigo=${report.incisosDuplicadosNoMesmoArtigo}`,
      `adct_separado=${report.adctSeparado ? "true" : "false"}`,
      `document_note_no_fim=${report.conteudoNaoNormativoNoFim ? "true" : "false"}`,
      `status_final=${report.statusParseavel ? "parseavel" : "nao_parseavel"}`,
      "===============================",
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

