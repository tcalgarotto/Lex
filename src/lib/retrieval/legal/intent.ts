/**
 * Classificação rica de intent jurídico para retrieval.
 *
 * Estende `classifyLegalQuery` (booleanos genéricos) com sinais que viram
 * filtros/boosts no pipeline de retrieval:
 *   - URNs explícitas (Lei 8.078/1990 → urn:lex:br:federal:lei:1990-09-11;8078).
 *   - Tribunal mencionado (STF/STJ/TST → filtro tribunal).
 *   - Súmula vinculante / repetitivo → boost de kind.
 *   - Janela temporal ("vigente em 01/05/2024" → asOf; "atual" → today).
 *   - Referência a artigo ("art. 5º" → boost).
 */

import { NormKind, type NormJurisdiction } from "@prisma/client";
import { classifyLegalQuery, type QueryClassification } from "@/lib/legal/query-classifier";
import { extractCitations } from "@/lib/corpus/citations";
import { normalizeArticleRef } from "./article-ref";

export type LegalIntent = {
  classification: QueryClassification;
  /** URNs detectadas no texto. */
  urns: string[];
  /** Sigla(s) de tribunal mencionadas. */
  tribunals: string[];
  /** Tipos preferenciais inferidos da pergunta. */
  preferredKinds: NormKind[];
  /** Jurisdição inferida (federal por default quando há lei sem UF). */
  preferredJurisdictions: NormJurisdiction[];
  /** Data "vigente em" ou similar. */
  asOf?: Date;
  /** Quer apenas normas publicadas após esta data. */
  publishedAfter?: Date;
  /** Referências a "Art. N" / "§ N" no texto. */
  articleRefs: string[];
  /** Heurística: query é principalmente de jurisprudência? */
  prefersJurisprudence: boolean;
  /** Heurística: query é principalmente sobre legislação? */
  prefersLegislation: boolean;
  /** Sinaliza que o usuário quer súmula. */
  wantsSumula: boolean;
  /** Quer texto vigente (vs. histórico). */
  wantsCurrent: boolean;
  /** Tags para observabilidade. */
  signals: string[];
};

const TRIBUNAL_RE = /\b(STF|STJ|TST|TJ[A-Z]{2}|TRF\d|TRT\d|TJSP|TJRJ|TJMG)\b/gi;
const ARTICLE_RE = /\bArt(?:igo)?\.?\s*(\d+\w*)/gi;

const DATE_PATTERNS: Array<{ re: RegExp; toDate: (m: RegExpMatchArray) => Date | null }> = [
  // "01/05/2024", "01-05-2024"
  {
    re: /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/,
    toDate: (m) => safeDate(`${m[3]}-${pad(m[2]!)}-${pad(m[1]!)}T00:00:00Z`),
  },
  // "em 2024" / "vigente em 2024"
  {
    re: /\b(?:em|vigente em)\s+(\d{4})\b/i,
    toDate: (m) => safeDate(`${m[1]}-01-01T00:00:00Z`),
  },
];

function pad(n: string): string {
  return n.padStart(2, "0");
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function inferKindsFromQuery(q: string): NormKind[] {
  const lower = q.toLowerCase();
  const kinds = new Set<NormKind>();
  if (/\b(s[úu]mula\s+vinculante)\b/.test(lower)) kinds.add(NormKind.SUMULA_VINCULANTE);
  if (/\bs[úu]mula\b/.test(lower)) {
    kinds.add(NormKind.SUMULA_STJ);
    kinds.add(NormKind.SUMULA_STF);
  }
  if (/\b(jurisprud[êe]ncia|ac[óo]rd[ãa]o|precedente)\b/.test(lower)) {
    kinds.add(NormKind.JURISPRUDENCE_STF);
    kinds.add(NormKind.JURISPRUDENCE_STJ);
    kinds.add(NormKind.JURISPRUDENCE_TST);
    kinds.add(NormKind.JURISPRUDENCE_OTHER);
  }
  if (/\brepetitiv(o|a)\b/.test(lower)) kinds.add(NormKind.REPETITIVE_THEME);
  if (/\b(lei\s+complementar|lc\s+\d)/.test(lower)) kinds.add(NormKind.COMPLEMENTARY_LAW);
  if (/\b(lei\s+\d|cdc|cc|cpc|cp|clt|ctn)\b/.test(lower)) kinds.add(NormKind.ORDINARY_LAW);
  if (/\b(decreto-lei)\b/.test(lower)) kinds.add(NormKind.DECREE_LAW);
  if (/\bdecreto\b/.test(lower)) kinds.add(NormKind.DECREE);
  if (/\b(medida\s+provis[óo]ria|mp\s+\d)/.test(lower)) kinds.add(NormKind.PROVISIONAL_MEASURE);
  if (/\b(emenda\s+constitucional|ec\s+\d)/.test(lower)) kinds.add(NormKind.CONSTITUTIONAL_AMENDMENT);
  if (/\b(constitui[çc][ãa]o|cf\/?88)\b/.test(lower)) kinds.add(NormKind.CONSTITUTION);
  return Array.from(kinds);
}

/**
 * Classifica intent jurídico a partir da query crua.
 */
export function classifyLegalIntent(rawQuery: string): LegalIntent {
  const classification = classifyLegalQuery(rawQuery);
  const signals: string[] = [...classification.signals];

  const cites = extractCitations(rawQuery);
  const urns = cites.map((c) => c.targetUrn);
  if (urns.length > 0) signals.push("has_citations");

  const tribunals = Array.from(
    new Set(
      [...rawQuery.matchAll(TRIBUNAL_RE)].map((m) => m[0].toUpperCase()),
    ),
  );
  if (tribunals.length > 0) signals.push("tribunal_mentioned");

  const articleRefs = Array.from(
    new Set(
      [...rawQuery.matchAll(ARTICLE_RE)]
        .map((m) => normalizeArticleRef(`Art. ${m[1]}`))
        .filter((r): r is string => r !== null),
    ),
  );
  if (articleRefs.length > 0) signals.push("article_ref");

  let asOf: Date | undefined;
  for (const p of DATE_PATTERNS) {
    const m = rawQuery.match(p.re);
    if (m) {
      const d = p.toDate(m);
      if (d) {
        asOf = d;
        break;
      }
    }
  }
  if (asOf) signals.push("asOf_date");

  const wantsCurrent =
    /\b(atual|hoje|vig[êe]nte|em vigor|atualmente)\b/i.test(rawQuery) || !asOf;
  if (wantsCurrent && !asOf) {
    asOf = new Date();
    signals.push("wants_current");
  }

  const preferredKinds = inferKindsFromQuery(rawQuery);
  const sumulaKinds: NormKind[] = [
    NormKind.SUMULA_STF,
    NormKind.SUMULA_STJ,
    NormKind.SUMULA_VINCULANTE,
  ];
  const legislationKinds: NormKind[] = [
    NormKind.CONSTITUTION,
    NormKind.CONSTITUTIONAL_AMENDMENT,
    NormKind.ORDINARY_LAW,
    NormKind.COMPLEMENTARY_LAW,
    NormKind.DECREE,
    NormKind.DECREE_LAW,
    NormKind.PROVISIONAL_MEASURE,
    NormKind.CODE,
  ];
  const wantsSumula = preferredKinds.some((k) => sumulaKinds.includes(k));
  if (wantsSumula) signals.push("wants_sumula");

  const prefersJurisprudence =
    preferredKinds.some((k) => k.toString().startsWith("JURISPRUDENCE")) ||
    classification.signals.includes("jurisprudence");
  const prefersLegislation =
    preferredKinds.some((k) => legislationKinds.includes(k)) ||
    classification.signals.includes("legal_basis");

  const preferredJurisdictions: NormJurisdiction[] = [];
  if (urns.some((u) => u.includes(":federal:"))) {
    preferredJurisdictions.push("FEDERAL");
  }
  if (tribunals.length > 0) {
    preferredJurisdictions.push("COURT");
    // Sigla de tribunal pode aparecer porque a query é sobre LEGISLAÇÃO que
    // *menciona* o tribunal (ex.: "órgãos do Poder Judiciário CNJ STJ TST"
    // → CF Art. 92). Sem o sinal explícito de `prefers_jurisprudence`,
    // mantemos FEDERAL no conjunto pra permitir retrieval da CF/leis.
    if (!prefersJurisprudence && !preferredJurisdictions.includes("FEDERAL")) {
      preferredJurisdictions.push("FEDERAL");
    }
  }

  return {
    classification,
    urns,
    tribunals,
    preferredKinds,
    preferredJurisdictions,
    ...(asOf ? { asOf } : {}),
    articleRefs,
    prefersJurisprudence,
    prefersLegislation,
    wantsSumula,
    wantsCurrent,
    signals,
  };
}
