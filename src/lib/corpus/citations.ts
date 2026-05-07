/**
 * Extração de citações jurídicas a partir de texto.
 *
 * Cobertura inicial (alto recall, alta precisão em formato canônico):
 *  - Leis ordinárias: "Lei nº 8.078/1990", "Lei n. 8078, de 11 de setembro de 1990"
 *  - Leis complementares: "Lei Complementar nº 116/2003", "LC 116/2003"
 *  - Decretos / Decretos-Lei
 *  - Medidas Provisórias
 *  - Emendas Constitucionais ("EC 132/2023")
 *  - Constituição Federal (CF/88, CF, art. X da Constituição)
 *  - Súmulas do STF (vinculantes ou não), STJ
 *  - Códigos: CC, CDC, CTN, CPC, CP, CLT (canonicamente conhecidos)
 *
 * Para cada citação devolvemos a URN-LEX construída quando temos certeza,
 * e o texto bruto (`rawText`) sempre. Confiança 0..1 reflete heurística.
 */

import { CitationKind } from "@prisma/client";
import { buildCanonicalUrn } from "./urn";

export type ExtractedCitation = {
  rawText: string;
  /** URN-LEX construída. Pode ser parcial (só ano) se o número não for confiável. */
  targetUrn: string;
  kind: CitationKind;
  /** Heurística 0..1; LLM ressolver pode subir depois. */
  confidence: number;
  /** Span no texto original [start, end). */
  span: [number, number];
};

const MONTHS_PT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", "março": "03",
  abril: "04", maio: "05", junho: "06", julho: "07",
  agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

function normalizeNumber(n: string): string {
  return n.replace(/\./g, "").trim();
}

function buildDate(year: string, month?: string, day?: string): string {
  const y = year.length === 2 ? `19${year}` : year.padStart(4, "0");
  const mm = (month ?? "01").padStart(2, "0");
  const dd = (day ?? "01").padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * Marcadores que aparecem ANTES do número da norma (todos opcionais e fora de grupo de captura).
 * Importante: usamos `(?!\d)` no fim de `[\d\.]+` pra evitar backtrack quebrando o número.
 */
const NUMERO_PREFIX = String.raw`(?:nº|n\.|n°|no\.?|número\s*)?\s*`;
const NUMBER = String.raw`([\d\.]+)`;
const ANO4 = String.raw`(\d{4})`;
const NUMBER_YEAR = String.raw`${NUMBER}\s*[\/,]\s*${ANO4}`;
const NUMBER_OF_DATE = String.raw`${NUMBER}\s*,?\s*de\s+(\d{1,2})\s+de\s+([a-záéíóúç]+)\s+de\s+(\d{4})`;

const CODE_MAP: Array<{ alias: RegExp; kind: CitationKind; urn: string; conf: number }> = [
  {
    alias: /\b(?:CDC|Código\s+de\s+Defesa\s+do\s+Consumidor)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:lei:1990-09-11;8078",
    conf: 0.95,
  },
  {
    alias: /\b(?:CC|Código\s+Civil)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:lei:2002-01-10;10406",
    conf: 0.92,
  },
  {
    alias: /\b(?:CPC|Código\s+de\s+Processo\s+Civil)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:lei:2015-03-16;13105",
    conf: 0.92,
  },
  {
    alias: /\b(?:CP|Código\s+Penal)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:decreto-lei:1940-12-07;2848",
    conf: 0.9,
  },
  {
    alias: /\b(?:CLT|Consolidação\s+das\s+Leis\s+do\s+Trabalho)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:decreto-lei:1943-05-01;5452",
    conf: 0.9,
  },
  {
    alias: /\b(?:CTN|Código\s+Tributário\s+Nacional)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:lei:1966-10-25;5172",
    conf: 0.9,
  },
  {
    alias: /\b(?:CF\/?88|Constituição\s+Federal|Constituição\s+da\s+República)\b/g,
    kind: CitationKind.CITES,
    urn: "urn:lex:br:federal:constituicao:1988-10-05;1988",
    conf: 0.95,
  },
];

type Pattern = {
  re: RegExp;
  toUrn: (match: RegExpExecArray) => { urn: string; conf: number };
  kind: CitationKind;
};

const PATTERNS: Pattern[] = [
  // "Lei Complementar nº 116/2003" / "LC 116/2003"
  {
    re: new RegExp(
      String.raw`\b(?:Lei\s+Complementar|LC)\s+${NUMERO_PREFIX}${NUMBER_YEAR}`,
      "gi",
    ),
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "federal",
        documentType: "lei.complementar",
        date: buildDate(m[2] ?? ""),
        number: normalizeNumber(m[1] ?? ""),
      }),
      conf: 0.9,
    }),
  },
  // "Lei nº 8.078, de 11 de setembro de 1990"
  {
    re: new RegExp(String.raw`\bLei\s+${NUMERO_PREFIX}${NUMBER_OF_DATE}`, "gi"),
    kind: CitationKind.CITES,
    toUrn: (m) => {
      const day = m[2];
      const monthName = (m[3] ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const year = m[4] ?? "";
      const month = MONTHS_PT[monthName];
      return {
        urn: buildCanonicalUrn({
          authority: "federal",
          documentType: "lei",
          date: buildDate(year, month, day),
          number: normalizeNumber(m[1] ?? ""),
        }),
        conf: 0.97,
      };
    },
  },
  // "Decreto-Lei nº 2.848/1940" — vem ANTES de "Decreto nº ..." pra ganhar prioridade.
  {
    re: new RegExp(
      String.raw`\bDecreto[- ]Lei\s+${NUMERO_PREFIX}${NUMBER_YEAR}`,
      "gi",
    ),
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "federal",
        documentType: "decreto-lei",
        date: buildDate(m[2] ?? ""),
        number: normalizeNumber(m[1] ?? ""),
      }),
      conf: 0.9,
    }),
  },
  // "Decreto nº 9.999/2019" — exige negar lookahead "Lei" pra não confundir Decreto-Lei
  {
    re: new RegExp(
      String.raw`\bDecreto(?![- ]Lei)\s+${NUMERO_PREFIX}${NUMBER_YEAR}`,
      "gi",
    ),
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "federal",
        documentType: "decreto",
        date: buildDate(m[2] ?? ""),
        number: normalizeNumber(m[1] ?? ""),
      }),
      conf: 0.85,
    }),
  },
  // "Lei nº 8.078/1990" / "Lei 8078/1990"
  {
    re: new RegExp(String.raw`\bLei\s+${NUMERO_PREFIX}${NUMBER_YEAR}`, "gi"),
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "federal",
        documentType: "lei",
        date: buildDate(m[2] ?? ""),
        number: normalizeNumber(m[1] ?? ""),
      }),
      conf: 0.9,
    }),
  },
  // "MP nº 1185/2023" / "Medida Provisória nº 1185/2023"
  {
    re: new RegExp(
      String.raw`\b(?:MP|Medida\s+Provisória)\s+${NUMERO_PREFIX}${NUMBER_YEAR}`,
      "gi",
    ),
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "federal",
        documentType: "medida.provisoria",
        date: buildDate(m[2] ?? ""),
        number: normalizeNumber(m[1] ?? ""),
      }),
      conf: 0.9,
    }),
  },
  // "EC 132/2023" / "Emenda Constitucional nº 132/2023"
  {
    re: new RegExp(
      String.raw`\b(?:EC|Emenda\s+Constitucional)\s+${NUMERO_PREFIX}${NUMBER_YEAR}`,
      "gi",
    ),
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "federal",
        documentType: "emenda.constitucional",
        date: buildDate(m[2] ?? ""),
        number: normalizeNumber(m[1] ?? ""),
      }),
      conf: 0.92,
    }),
  },
  // "Súmula Vinculante 14"
  {
    re: /\bSúmula\s+Vinculante\s+(?:nº|n\.)?\s*(\d+)/gi,
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "supremo.tribunal.federal",
        documentType: "sumula.vinculante",
        number: m[1] ?? "",
      }),
      conf: 0.9,
    }),
  },
  // "Súmula 511 do STJ" / "Súmula nº 511 — STJ"
  {
    re: /\bSúmula\s+(?:nº|n\.)?\s*(\d+)\s+(?:do\s+)?(?:STJ|Superior\s+Tribunal\s+de\s+Justiça)/gi,
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "superior.tribunal.justica",
        documentType: "sumula",
        number: m[1] ?? "",
      }),
      conf: 0.9,
    }),
  },
  // "Súmula 7 do STF"
  {
    re: /\bSúmula\s+(?:nº|n\.)?\s*(\d+)\s+(?:do\s+)?(?:STF|Supremo\s+Tribunal\s+Federal)/gi,
    kind: CitationKind.CITES,
    toUrn: (m) => ({
      urn: buildCanonicalUrn({
        authority: "supremo.tribunal.federal",
        documentType: "sumula",
        number: m[1] ?? "",
      }),
      conf: 0.9,
    }),
  },
];

/** Deduplica por (urn). Mantém a primeira ocorrência (menor span). */
function dedupe(citations: ExtractedCitation[]): ExtractedCitation[] {
  const seen = new Set<string>();
  const out: ExtractedCitation[] = [];
  for (const c of citations) {
    if (seen.has(c.targetUrn)) continue;
    seen.add(c.targetUrn);
    out.push(c);
  }
  return out;
}

/**
 * Extrai citações de um trecho. Idempotente.
 */
export function extractCitations(text: string): ExtractedCitation[] {
  if (!text) return [];
  const collected: ExtractedCitation[] = [];

  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const { urn, conf } = p.toUrn(match);
      collected.push({
        rawText: match[0],
        targetUrn: urn,
        kind: p.kind,
        confidence: conf,
        span: [match.index, match.index + match[0].length],
      });
    }
  }

  for (const code of CODE_MAP) {
    const re = new RegExp(code.alias.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      collected.push({
        rawText: match[0],
        targetUrn: code.urn,
        kind: code.kind,
        confidence: code.conf,
        span: [match.index, match.index + match[0].length],
      });
    }
  }

  collected.sort((a, b) => a.span[0] - b.span[0]);
  return dedupe(collected);
}
