/**
 * URN-LEX (Brasil) — parser e builder canônicos.
 *
 * Especificação: https://www.lexml.gov.br/wiki/Padrao_LexML — formato:
 *   urn:lex:<jurisdição>:<autoridade>:<tipo-documento>:<descritor>
 *
 * Onde, para o Brasil:
 *   urn:lex:br:[<uf>;]?<autoridade>:<tipo>:<data>;<numero>[!<fragmento>]
 *
 * Exemplos canônicos:
 *   urn:lex:br:federal:lei:1990-09-11;8078
 *   urn:lex:br:federal:decreto-lei:1969-10-01;1001
 *   urn:lex:br:federal:emenda.constitucional:2023-12-20;132
 *   urn:lex:br:federal:medida.provisoria:2023-08-28;1185
 *   urn:lex:br:supremo.tribunal.federal:sumula.vinculante:2007-10-30;14
 *   urn:lex:br:superior.tribunal.justica:sumula:2014-09-22;511
 *   urn:lex:br:superior.tribunal.justica:resp:2019-04-23;1797175!ementa
 *
 * Aqui mantemos um parser tolerante (aceita variações reais que aparecem no
 * LexML) e um builder estrito (sempre minúsculo, sem espaços, sem acentos).
 */

import { NormKind, NormJurisdiction } from "@prisma/client";

export type LexUrn = {
  /** URN canônica (lowercased, sem espaços). */
  urn: string;
  /** "br". Sempre brasileiro nesse contexto. */
  country: string;
  /** Ex.: "federal", "estadual", "supremo.tribunal.federal", "superior.tribunal.justica". */
  authority: string;
  /** Ex.: "lei", "decreto-lei", "emenda.constitucional", "sumula". */
  documentType: string;
  /** ISO yyyy-mm-dd quando há data. */
  date?: string;
  /** Número (string pra preservar zeros à esquerda, formatos compostos). */
  number?: string;
  /** Fragmento após "!" (ex.: "ementa", "art1"). */
  fragment?: string;
  /** UF sigla (ex.: "sp", "rj") quando estadual. */
  uf?: string;
};

const URN_RE = /^urn:lex:br:([^:]+):([^:]+):([^!]*)?(?:!(.*))?$/i;

export class UrnLexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrnLexError";
  }
}

/**
 * Faz parsing tolerante. Lança `UrnLexError` se não bater no formato base.
 */
export function parseUrnLex(input: string): LexUrn {
  const raw = input.trim().toLowerCase();
  const m = URN_RE.exec(raw);
  if (!m) throw new UrnLexError(`URN-LEX inválida: ${input}`);

  const [, authorityFull, documentType, descriptor, fragment] = m;
  if (!authorityFull || !documentType) {
    throw new UrnLexError(`URN-LEX sem autoridade ou tipo: ${input}`);
  }

  // authority pode vir como "<uf>;<autoridade>" para estaduais ou só "<autoridade>".
  let uf: string | undefined;
  let authority = authorityFull;
  if (authority.includes(";")) {
    const parts = authority.split(";");
    if (parts.length === 2 && /^[a-z]{2}$/.test(parts[0]!)) {
      uf = parts[0]!;
      authority = parts[1]!;
    }
  }

  // descriptor: "<data>;<numero>" — ambos opcionais individualmente
  let date: string | undefined;
  let number: string | undefined;
  if (descriptor) {
    const [d, n] = descriptor.split(";");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) date = d;
    else if (d && /^\d{4}$/.test(d)) date = `${d}-01-01`;
    if (n) number = n;
  }

  return {
    urn: buildCanonicalUrn({ country: "br", uf, authority, documentType, date, number, fragment }),
    country: "br",
    authority,
    documentType,
    ...(date !== undefined ? { date } : {}),
    ...(number !== undefined ? { number } : {}),
    ...(fragment !== undefined ? { fragment } : {}),
    ...(uf !== undefined ? { uf } : {}),
  };
}

/**
 * Constrói uma URN-LEX canônica a partir das partes. Sempre lowercased,
 * sem acentos e sem espaços. Não valida data — apenas formata.
 */
export function buildCanonicalUrn(params: {
  country?: string;
  uf?: string;
  authority: string;
  documentType: string;
  date?: string;
  number?: string;
  fragment?: string;
}): string {
  const country = (params.country ?? "br").toLowerCase();
  const authorityWithUf = params.uf
    ? `${params.uf.toLowerCase()};${normalizeUrnPart(params.authority)}`
    : normalizeUrnPart(params.authority);
  const docType = normalizeUrnPart(params.documentType);

  const descriptorParts: string[] = [];
  if (params.date) descriptorParts.push(params.date);
  if (params.number) descriptorParts.push(normalizeUrnPart(params.number));
  const descriptor = descriptorParts.join(";");

  let urn = `urn:lex:${country}:${authorityWithUf}:${docType}`;
  if (descriptor) urn += `:${descriptor}`;
  if (params.fragment) urn += `!${normalizeUrnPart(params.fragment)}`;
  return urn;
}

/**
 * Normaliza partes da URN: lowercase, remove acentos, troca espaço por hífen,
 * preserva pontos (separador hierárquico canônico) e ; (separador descritor).
 */
export function normalizeUrnPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.;_\-]/g, "");
}

/**
 * Mapeia o `documentType` da URN-LEX para nosso `NormKind`.
 * Conservador: o que não bater vira `OTHER`.
 */
export function classifyKindFromUrn(urn: LexUrn): NormKind {
  const t = urn.documentType;
  const a = urn.authority;

  if (a.includes("supremo.tribunal.federal")) {
    if (t.startsWith("sumula.vinculante")) return NormKind.SUMULA_VINCULANTE;
    if (t.startsWith("sumula")) return NormKind.SUMULA_STF;
    return NormKind.JURISPRUDENCE_STF;
  }
  if (a.includes("superior.tribunal.justica")) {
    if (t.startsWith("sumula")) return NormKind.SUMULA_STJ;
    return NormKind.JURISPRUDENCE_STJ;
  }
  if (a.includes("tribunal.superior.trabalho") || a === "tst") {
    return NormKind.JURISPRUDENCE_TST;
  }

  switch (t) {
    case "constituicao":
      return NormKind.CONSTITUTION;
    case "emenda.constitucional":
      return NormKind.CONSTITUTIONAL_AMENDMENT;
    case "lei.complementar":
      return NormKind.COMPLEMENTARY_LAW;
    case "lei":
      return NormKind.ORDINARY_LAW;
    case "lei.delegada":
      return NormKind.DELEGATED_LAW;
    case "medida.provisoria":
      return NormKind.PROVISIONAL_MEASURE;
    case "decreto-lei":
      return NormKind.DECREE_LAW;
    case "decreto":
      return NormKind.DECREE;
    case "resolucao":
      return NormKind.RESOLUTION;
    case "portaria":
      return NormKind.PORTARIA;
    case "instrucao.normativa":
      return NormKind.NORMATIVE_INSTRUCTION;
    case "circular":
      return NormKind.CIRCULAR;
    case "codigo":
      return NormKind.CODE;
    case "regimento":
      return NormKind.REGIMENT;
    case "sumula":
      return NormKind.SUMULA_STJ; // fallback razoável; chamador refina
    case "sumula.vinculante":
      return NormKind.SUMULA_VINCULANTE;
    default:
      return NormKind.OTHER;
  }
}

/** Mapeia autoridade -> jurisdição (esfera). */
export function classifyJurisdictionFromUrn(urn: LexUrn): NormJurisdiction {
  if (urn.uf) return NormJurisdiction.STATE;
  if (urn.authority === "federal") return NormJurisdiction.FEDERAL;
  if (urn.authority.includes("municipal")) return NormJurisdiction.MUNICIPAL;
  if (urn.authority.includes("distrital")) return NormJurisdiction.DISTRITAL;
  if (urn.authority.includes("tribunal")) return NormJurisdiction.COURT;
  if (urn.authority.includes("agencia")) return NormJurisdiction.AGENCY;
  return NormJurisdiction.UNKNOWN;
}

/** Identificador humano canônico ("Lei nº 8.078/1990"). */
export function humanIdentifier(urn: LexUrn): string {
  const labels: Record<string, string> = {
    "lei": "Lei nº",
    "lei.complementar": "Lei Complementar nº",
    "decreto": "Decreto nº",
    "decreto-lei": "Decreto-Lei nº",
    "medida.provisoria": "MP nº",
    "emenda.constitucional": "EC nº",
    "constituicao": "Constituição",
    "sumula": "Súmula",
    "sumula.vinculante": "Súmula Vinculante",
    "resolucao": "Resolução nº",
    "portaria": "Portaria nº",
    "instrucao.normativa": "IN nº",
  };
  const label = labels[urn.documentType] ?? urn.documentType;
  const number = urn.number ?? "";
  const year = urn.date ? `/${urn.date.slice(0, 4)}` : "";
  return [label, number].filter(Boolean).join(" ") + year;
}
