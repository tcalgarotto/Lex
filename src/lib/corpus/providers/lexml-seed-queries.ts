/**
 * Queries seed prioritárias para o vade mecum brasileiro.
 *
 * Cada entrada descreve UMA norma "âncora" do direito nacional. O script
 * `corpus:seed:lexml` itera sobre essas entradas e usa a query CQL para
 * encontrar a URN-LEX exata via SRU.
 *
 * Política:
 *  - Não baixar tudo: cada query tem `expectedUrn` para early-stop quando
 *    a norma alvo aparecer.
 *  - Áreas alinhadas com `src/lib/legal/domain-packs/`.
 */

import { NormKind } from "@prisma/client";

export type LexmlSeedQuery = {
  /** Query SRU/CQL aproximada (ex.: "Lei 8078 1990"). */
  query: string;
  /** Tipo dominante para filtragem rápida. */
  kind: NormKind;
  /** Identificador humano. */
  label: string;
  /** Domínio/area jurídica (combina com domain-packs). */
  area: string;
  /** URN-LEX esperada — quando o parser encontrar esta URN, marca como achado. */
  expectedUrn?: string;
  /** Para deduplicar contra LegalNorm. */
  identifierHint?: string;
};

export const LEXML_SEED_QUERIES: ReadonlyArray<LexmlSeedQuery> = [
  // ---- Constitucional ----
  {
    query: "Constituição Federal 1988",
    kind: NormKind.CONSTITUTION,
    label: "Constituição Federal de 1988",
    area: "constitucional",
    expectedUrn: "urn:lex:br:federal:constituicao:1988-10-05;1988",
    identifierHint: "Constituição Federal/1988",
  },

  // ---- Códigos centrais ----
  {
    query: "Código Civil Lei 10406 2002",
    kind: NormKind.ORDINARY_LAW,
    label: "Código Civil — Lei 10.406/2002",
    area: "civil",
    expectedUrn: "urn:lex:br:federal:lei:2002-01-10;10406",
    identifierHint: "Lei nº 10.406/2002",
  },
  {
    query: "Código de Processo Civil Lei 13105 2015",
    kind: NormKind.ORDINARY_LAW,
    label: "Código de Processo Civil — Lei 13.105/2015",
    area: "contencioso",
    expectedUrn: "urn:lex:br:federal:lei:2015-03-16;13105",
    identifierHint: "Lei nº 13.105/2015",
  },
  {
    query: "Código de Defesa do Consumidor Lei 8078 1990",
    kind: NormKind.ORDINARY_LAW,
    label: "Código de Defesa do Consumidor — Lei 8.078/1990",
    area: "consumidor",
    expectedUrn: "urn:lex:br:federal:lei:1990-09-11;8078",
    identifierHint: "Lei nº 8.078/1990",
  },
  {
    query: "CLT Decreto-Lei 5452 1943",
    kind: NormKind.DECREE_LAW,
    label: "CLT — Decreto-Lei 5.452/1943",
    area: "trabalho",
    expectedUrn: "urn:lex:br:federal:decreto-lei:1943-05-01;5452",
    identifierHint: "Decreto-Lei nº 5.452/1943",
  },

  // ---- Estatutos ----
  {
    query: "Estatuto da Criança e do Adolescente Lei 8069 1990",
    kind: NormKind.ORDINARY_LAW,
    label: "ECA — Lei 8.069/1990",
    area: "crianca-adolescente",
    expectedUrn: "urn:lex:br:federal:lei:1990-07-13;8069",
    identifierHint: "Lei nº 8.069/1990",
  },
  {
    query: "Estatuto do Idoso Lei 10741 2003",
    kind: NormKind.ORDINARY_LAW,
    label: "Estatuto do Idoso — Lei 10.741/2003",
    area: "idoso",
    expectedUrn: "urn:lex:br:federal:lei:2003-10-01;10741",
    identifierHint: "Lei nº 10.741/2003",
  },
  {
    query: "Lei Maria da Penha 11340 2006",
    kind: NormKind.ORDINARY_LAW,
    label: "Lei Maria da Penha — Lei 11.340/2006",
    area: "maria-da-penha",
    expectedUrn: "urn:lex:br:federal:lei:2006-08-07;11340",
    identifierHint: "Lei nº 11.340/2006",
  },
  {
    query: "Estatuto da Advocacia Lei 8906 1994",
    kind: NormKind.ORDINARY_LAW,
    label: "Estatuto da Advocacia — Lei 8.906/1994",
    area: "advocacia-etica-prerrogativas",
    expectedUrn: "urn:lex:br:federal:lei:1994-07-04;8906",
    identifierHint: "Lei nº 8.906/1994",
  },

  // ---- Previdenciário ----
  {
    query: "Lei de Benefícios Previdenciários 8213 1991",
    kind: NormKind.ORDINARY_LAW,
    label: "Lei de Benefícios Previdenciários — Lei 8.213/1991",
    area: "previdenciario",
    expectedUrn: "urn:lex:br:federal:lei:1991-07-24;8213",
    identifierHint: "Lei nº 8.213/1991",
  },

  // ---- Família / locação / registros ----
  {
    query: "Lei do Inquilinato 8245 1991",
    kind: NormKind.ORDINARY_LAW,
    label: "Lei do Inquilinato — Lei 8.245/1991",
    area: "contratos",
    expectedUrn: "urn:lex:br:federal:lei:1991-10-18;8245",
    identifierHint: "Lei nº 8.245/1991",
  },
  {
    query: "Lei de Alimentos 5478 1968",
    kind: NormKind.ORDINARY_LAW,
    label: "Lei de Alimentos — Lei 5.478/1968",
    area: "familia",
    expectedUrn: "urn:lex:br:federal:lei:1968-07-25;5478",
    identifierHint: "Lei nº 5.478/1968",
  },
  {
    query: "Lei de Registros Públicos 6015 1973",
    kind: NormKind.ORDINARY_LAW,
    label: "Lei de Registros Públicos — Lei 6.015/1973",
    area: "extrajudicial",
    expectedUrn: "urn:lex:br:federal:lei:1973-12-31;6015",
    identifierHint: "Lei nº 6.015/1973",
  },

  // ---- Privacidade / improbidade ----
  {
    query: "Lei Geral de Proteção de Dados LGPD 13709 2018",
    kind: NormKind.ORDINARY_LAW,
    label: "LGPD — Lei 13.709/2018",
    area: "privacidade",
    expectedUrn: "urn:lex:br:federal:lei:2018-08-14;13709",
    identifierHint: "Lei nº 13.709/2018",
  },
  {
    query: "Lei de Improbidade Administrativa 8429 1992",
    kind: NormKind.ORDINARY_LAW,
    label: "Lei de Improbidade Administrativa — Lei 8.429/1992",
    area: "administrativo",
    expectedUrn: "urn:lex:br:federal:lei:1992-06-02;8429",
    identifierHint: "Lei nº 8.429/1992",
  },
];

/** Filtra seeds por uma lista de áreas (domain-pack ids). */
export function getLexmlSeedsForAreas(areas: string[]): LexmlSeedQuery[] {
  if (areas.length === 0) return [...LEXML_SEED_QUERIES];
  const set = new Set(areas);
  return LEXML_SEED_QUERIES.filter((s) => set.has(s.area));
}
