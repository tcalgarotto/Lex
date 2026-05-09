/**
 * Intake jurídico determinístico.
 *
 * Recebe texto livre (relato do advogado, resumo do cliente, e-mail, etc.) e
 * extrai estrutura jurídica:
 *
 *   - Título curto (heurístico)
 *   - Resumo (1ª frase substantiva)
 *   - Partes (autor/réu/etc), com CPF/CNPJ quando explícito
 *   - Fatos numerados (split por sentença com filtro semântico)
 *   - Pedidos (tutela/indenização/restituição/principal/subsidiário)
 *   - Tribunal/UF/processo quando o texto deixa pistas
 *
 * IMPORTANTE: parser determinístico — nada de LLM no caminho crítico.
 * LLM pode aprimorar depois, mas a fundação tem que ser auditável.
 */

import {
  CasePartyKind,
  CasePartyRole,
  CaseRequestKind,
  NormJurisdiction,
} from "@prisma/client";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import type {
  IntakeResult,
  ParsedFact,
  ParsedParty,
  ParsedRequest,
} from "./types";

/* ---------------------------- regex base -------------------------------- */

// "Autor: Fulano de Tal", "Réu: Banco XYZ S/A", "Embargante:"
const PARTY_LINE_RE =
  /\b(autor[a]?|requerente|embargante|reclamante|exeq[uü]ente|impetrante)s?\s*[:\-–]\s*([^\n;]+)/gi;
const DEFENDANT_LINE_RE =
  /\b(r[eé]u[s]?|requerid[ao]s?|embargad[ao]s?|reclamad[ao]s?|executad[ao]s?|impetrad[ao]s?|coatorid[ao]s?|coatora?)\s*[:\-–]\s*([^\n;]+)/gi;
const INTERVENING_LINE_RE =
  /\b(terceir[ao]\s+interessad[ao]|assistente|amicus\s+curiae|litisconsorte)s?\s*[:\-–]\s*([^\n;]+)/gi;

const CPF_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
const CNPJ_RE = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;

const PROCESS_NUMBER_RE =
  /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;

const UF_RE = /\b(?:UF[:\-–]\s*)?(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

const TRIBUNAL_LINE_RE = /\b(STF|STJ|TST|TSE|STM|TJ[A-Z]{2}|TRF\d|TRT\d{1,2}|TRE[A-Z]{2}|TJM[A-Z]{2})\b/;

// Datas no formato dd/mm/aaaa ou ISO simples
const DATE_DDMMYYYY_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;
const DATE_ISO_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;

/**
 * Verbos dispositivos típicos de PEDIDO jurídico. Sempre testados com
 * `\b...\b` (ver {@link isLikelyRequest}) para evitar que palavras como
 * "requerida" / "requerido" / "pedido administrativo" sejam classificadas
 * como pedido — falso positivo histórico que vinha colocando fato como
 * pedido na minuta (ver QA manual creche, item #2 de UX_FLOW_AUDIT).
 *
 * Lista expandida cobre as formas mais comuns no português jurídico
 * brasileiro.
 */
const REQUEST_VERBS = [
  "requer",
  "requer-se",
  "pleiteia",
  "postula",
  "pugna",
  "pretende",
  "pede",
  "pede-se",
  "solicita",
  "objetiva",
  "busca",
  "demanda",
  "espera",
  "espera-se",
  "aguarda",
  "protesta",
  "formula",
  "deduz",
  "intenta",
  "promove",
];

/**
 * Regex anchored por `\b...\b` montada uma única vez para cobrir todos
 * os verbos dispositivos. Evita que `lower.includes("requer")` case com
 * `requerida` / `requerido` (situação que classificava réu como pedido).
 */
const REQUEST_VERBS_RE = new RegExp(
  `\\b(?:${REQUEST_VERBS.map((v) => v.replace(/-/g, "\\-")).join("|")})\\b`,
  "i",
);

/**
 * Indícios fortes de pedido jurídico que não dependem de verbo (locuções
 * adverbiais comuns no juridiquês). Também usado em `isLikelyRequest`.
 */
const REQUEST_PHRASE_RE = new RegExp(
  [
    "\\baguarda(?:\\s+deferimento|\\s+provimento)\\b",
    "\\bdeferimento\\s+da\\s+(?:tutela|liminar)\\b",
    "\\bjusti[cç]a\\s+gratuita\\b",
    "\\bprodu[cç][aã]o\\s+de\\s+prova\\b",
    "\\bcondena[cç][aã]o\\s+(?:da|do|de)\\b",
    "\\bressarcimento\\s+(?:de|por)\\b",
    "\\bproced[eê]ncia\\s+(?:da|do)\\s+pedido\\b",
  ].join("|"),
  "i",
);

// Categorias heurísticas para fatos
const FACT_CATEGORY_PATTERNS: Array<[string, RegExp]> = [
  ["data", /\b\d{2}\/\d{2}\/\d{4}\b|\bem\s+\d{1,2}\s+de\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i],
  ["dano", /\b(dano|preju[ií]zo|sofreu|abalo|moral|material|est[ée]tico)\b/i],
  ["conduta", /\b(realizou|negou|deixou|recusou|impediu|cancelou|interrompeu|suspendeu|n[aã]o\s+entregou|atrasou)\b/i],
  ["vinculo", /\b(contrato|contratou|firmou|aderiu|cliente|empregado|admitido|colaborador|prestador)\b/i],
  ["valor", /\bR\$\s*\d|\b(valor|montante|importe)\s+de\b/i],
  ["mora", /\b(inadimplemento|inadimpl[eê]ncia|atraso|vencido|n[aã]o\s+pagou|cobran[cç]a\s+indevida)\b/i],
  ["tutela", /\b(tutela|antecipa[cç][aã]o|liminar|urg[eê]ncia)\b/i],
];

/* ---------------------------- API pública ------------------------------- */

export function runIntake(rawInput: string): IntakeResult {
  const text = normalizeWhitespace(rawInput);
  const sentences = splitSentences(text);

  const parties = extractParties(text);
  const facts = extractFacts(sentences);
  const requests = extractRequests(sentences);
  const tribunalCode = detectTribunal(text);
  const uf = detectUf(text);
  const processNumber = detectProcessNumber(text);
  const jurisdiction = inferJurisdiction(tribunalCode);
  const title = buildTitle(text, parties, requests);
  const summary = buildSummary(sentences);

  return {
    title,
    summary,
    ...(tribunalCode ? { tribunalCode } : {}),
    ...(uf ? { uf } : {}),
    ...(processNumber ? { processNumber } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    facts,
    parties,
    requests,
    risks: [], // riscos vem do retrieval/contradiction (preenchidos no orchestrator de cases)
  };
}

/* ---------------------------- parsing helpers --------------------------- */

export function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split básico por sentença com proteção a abreviações jurídicas comuns
 * (Art., §, inc., LC, EC, c/c, S/A).
 */
export function splitSentences(text: string): string[] {
  // Substitui abreviações por placeholders
  const DOT = "§§D§§";
  const SLASH = "§§S§§";
  const protect = text
    .replace(/\bArt\./gi, `Art${DOT}`)
    .replace(/\bArts\./gi, `Arts${DOT}`)
    .replace(/\bp\./gi, `p${DOT}`)
    .replace(/\bDra?\./gi, (m) => m.replace(".", DOT))
    .replace(/\bSr[ae]?\./gi, (m) => m.replace(".", DOT))
    .replace(/\bS\/A/g, `S${SLASH}A`)
    .replace(/\bc\/c/g, `c${SLASH}c`);
  const parts = protect.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/);
  return parts
    .map((p) => p.replace(new RegExp(DOT, "g"), ".").replace(new RegExp(SLASH, "g"), "/").trim())
    .filter((p) => p.length >= 8);
}

export function extractParties(text: string): ParsedParty[] {
  const out: ParsedParty[] = [];
  const seen = new Set<string>();

  function pushFromRegex(regex: RegExp, role: CasePartyRole) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const rawName = (m[2] || "").trim().replace(/[.,;]+$/, "");
      if (!rawName) continue;
      // Pode haver múltiplas partes separadas por " e " ou " , "
      const candidates = rawName.split(/\s+e\s+|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
      for (const name of candidates) {
        const key = `${role}::${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cpf = CPF_RE.exec(name)?.[0];
        const cnpj = CNPJ_RE.exec(name)?.[0];
        const document = cpf ?? cnpj;
        const cleanName = name.replace(CPF_RE, "").replace(CNPJ_RE, "").trim().replace(/^[\-–]\s*/, "");
        if (!cleanName) continue;
        const partyKind = inferKind(cleanName, document);
        const baseEntry: ParsedParty = { role, kind: partyKind, name: cleanName };
        if (document) {
          out.push({ ...baseEntry, document });
        } else {
          out.push(baseEntry);
        }
      }
    }
  }

  pushFromRegex(PARTY_LINE_RE, CasePartyRole.AUTHOR);
  pushFromRegex(DEFENDANT_LINE_RE, CasePartyRole.DEFENDANT);
  pushFromRegex(INTERVENING_LINE_RE, CasePartyRole.INTERVENING);

  return out;
}

function inferKind(name: string, document?: string): CasePartyKind {
  if (document) {
    if (/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(document)) return CasePartyKind.COMPANY;
    return CasePartyKind.PERSON;
  }
  if (/\b(uni[aã]o|estado|munic[ií]pio|prefeitura|fazenda|inss|ibama|anvisa|funai|incra|caixa\s+econ[oô]mica)\b/i.test(name))
    return CasePartyKind.PUBLIC_ENTITY;
  if (/\b(s\.?\s*a|ltda|me|epp|eireli|associa[cç][aã]o|sindicato|cooperativa|companhia)\b/i.test(name))
    return CasePartyKind.COMPANY;
  if (/^[A-ZÁÉÍÓÚ][a-záéíóúâêôãõç]+(\s+[A-ZÁÉÍÓÚ][a-záéíóúâêôãõç]+){1,4}$/.test(name))
    return CasePartyKind.PERSON;
  return CasePartyKind.UNKNOWN;
}

export function extractFacts(sentences: string[]): ParsedFact[] {
  const out: ParsedFact[] = [];
  let ord = 1;
  for (const s of sentences) {
    if (isLikelyRequest(s) || isMetaSentence(s)) continue;
    const dates = extractDates(s);
    const category = inferCategory(s);
    const confidence = scoreFactConfidence(s, dates.length, !!category);
    const fact: ParsedFact = {
      ordinal: ord,
      text: s,
      dates,
      confidence,
    };
    if (category) fact.category = category;
    out.push(fact);
    ord += 1;
  }
  return out;
}

/**
 * Detecta se a sentença é um PEDIDO jurídico (verbo dispositivo ou
 * locução típica). Usa `\b...\b` para evitar que substrings dentro de
 * palavras maiores (ex.: "requerida", "pedido administrativo") sejam
 * confundidas com verbos dispositivos.
 *
 * Exportado para que `consolidateCaseBrain` possa reaproveitar o mesmo
 * classificador na fase de pré-extract heurística.
 */
export function isLikelyRequest(sentence: string): boolean {
  if (REQUEST_VERBS_RE.test(sentence)) return true;
  if (REQUEST_PHRASE_RE.test(sentence)) return true;
  return false;
}

function isMetaSentence(sentence: string): boolean {
  // Linhas como "Tribunal: TJSP" ou "Autor:" — não são fatos
  return /^\s*(autor[a]?|r[eé]u|tribunal|processo|uf|comarca|vara)\s*[:\-–]/i.test(sentence);
}

export function extractDates(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  DATE_DDMMYYYY_RE.lastIndex = 0;
  while ((m = DATE_DDMMYYYY_RE.exec(text)) !== null) {
    const dd = m[1];
    const mm = m[2];
    const yyyy = m[3];
    if (dd && mm && yyyy) out.push(`${yyyy}-${mm}-${dd}`);
  }
  DATE_ISO_RE.lastIndex = 0;
  while ((m = DATE_ISO_RE.exec(text)) !== null) {
    const captured = m[1];
    if (captured) out.push(captured);
  }
  return Array.from(new Set(out));
}

function inferCategory(s: string): string | undefined {
  for (const [name, re] of FACT_CATEGORY_PATTERNS) {
    if (re.test(s)) return name;
  }
  return undefined;
}

function scoreFactConfidence(s: string, dateCount: number, hasCategory: boolean): number {
  let c = 0.5;
  if (dateCount > 0) c += 0.15;
  if (hasCategory) c += 0.1;
  if (s.length > 60) c += 0.1;
  if (/\b\d/.test(s)) c += 0.05;
  return Math.min(c, 0.95);
}

export function extractRequests(sentences: string[]): ParsedRequest[] {
  const out: ParsedRequest[] = [];
  let ord = 1;
  for (const s of sentences) {
    if (!isLikelyRequest(s)) continue;
    const lower = s.toLowerCase();
    let kind: CaseRequestKind = CaseRequestKind.MAIN;
    if (/\btutela|liminar|urg[eê]ncia|antecipa[cç][aã]o\b/.test(lower)) kind = CaseRequestKind.URGENCY;
    else if (/\bmulta\s+di[áa]ria|astreintes?|cominat[óo]ri[ao]\b/.test(lower)) kind = CaseRequestKind.PROVISIONAL;
    else if (/\bsubsidiariamente|altern\w+\b/.test(lower)) kind = CaseRequestKind.SUBSIDIARY;
    else if (/\bprodu[cç][aã]o\s+de\s+prova|per[ií]cia|testemunh\w+\b/.test(lower)) kind = CaseRequestKind.EVIDENCE;
    else if (/\bjusti[cç]a\s+gratuita|prioridade|segredo\s+de\s+justi[cç]a\b/.test(lower)) kind = CaseRequestKind.PROCEDURAL;
    out.push({
      ordinal: ord,
      kind,
      text: s,
    });
    ord += 1;
  }
  return out;
}

export function detectTribunal(text: string): string | undefined {
  const m = TRIBUNAL_LINE_RE.exec(text);
  if (!m || !m[1]) return undefined;
  const code = m[1].toUpperCase();
  return getTribunal(code) ? code : undefined;
}

export function detectUf(text: string): string | undefined {
  const m = UF_RE.exec(text);
  return m && m[1] ? m[1].toUpperCase() : undefined;
}

export function detectProcessNumber(text: string): string | undefined {
  const m = PROCESS_NUMBER_RE.exec(text);
  return m ? m[0] : undefined;
}

function inferJurisdiction(tribunalCode?: string): NormJurisdiction | undefined {
  if (!tribunalCode) return undefined;
  return getTribunal(tribunalCode)?.jurisdiction;
}

export function buildTitle(text: string, parties: ParsedParty[], requests: ParsedRequest[]): string {
  const author = parties.find((p) => p.role === CasePartyRole.AUTHOR)?.name;
  const defendant = parties.find((p) => p.role === CasePartyRole.DEFENDANT)?.name;
  const action = requests[0]?.text.replace(/^\s*\d+[).\-]\s*/, "").slice(0, 60);
  if (author && defendant) {
    return shortenTitle(`${capitalize(author)} x ${capitalize(defendant)}${action ? ` — ${action}` : ""}`);
  }
  if (author) return shortenTitle(`${capitalize(author)}${action ? ` — ${action}` : ""}`);
  if (action) return shortenTitle(action);
  // fallback: primeiras palavras significativas
  const head = text
    .split(/\s+/)
    .slice(0, 12)
    .join(" ")
    .replace(/[.;,]+$/, "");
  return shortenTitle(head || "Caso sem título");
}

function shortenTitle(s: string, max = 120): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function capitalize(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (w.length === 0) return w;
      if (w.length <= 2) return w.toLowerCase();
      const first = w[0] ?? "";
      return first.toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function buildSummary(sentences: string[]): string {
  // Primeira sentença não-meta com >40 caracteres.
  for (const s of sentences) {
    if (!isMetaSentence(s) && s.length >= 40) return shortenTitle(s, 240);
  }
  return sentences[0] ?? "";
}
