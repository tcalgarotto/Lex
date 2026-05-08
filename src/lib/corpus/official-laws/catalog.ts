/**
 * Catálogo oficial das leis/códigos federais que o Lex deve manter
 * sempre indexados. URLs apontam pro Planalto (fonte primária).
 *
 * Cada item declara:
 *   - `key`: identificador interno estável (CPC, CDC, LMP, etc.).
 *   - `urn`: URN-LEX canônica.
 *   - `kind`: tipo no schema Prisma.
 *   - `sourceUrl`: URL Planalto (HTML).
 *   - `priority`: ordem de seed (maior = mais cedo).
 *   - `aliases`: termos alternativos pra match em busca.
 *   - `domainPacks`: áreas do direito relacionadas (Strategy/Cases).
 *   - `expectedArticleCount`: faixa esperada (sanity check pós-parse).
 *
 * O usuário desta sessão pediu: "todas as leis, de todos os códigos,
 * dentro do sistema, organizadas sistematicamente". Este catálogo é o
 * ponto único de configuração — adicionar uma lei aqui é tudo o que
 * precisa pra que `corpus:seed:official-laws` faça download + parse +
 * upsert + embed.
 */

import { NormKind } from "@prisma/client";

export type DomainPack =
  | "constitucional"
  | "civil"
  | "processual_civil"
  | "consumidor"
  | "trabalhista"
  | "penal"
  | "processual_penal"
  | "familia"
  | "infancia_juventude"
  | "idoso"
  | "violencia_domestica"
  | "advocacia"
  | "previdenciario"
  | "imobiliario_locacao"
  | "protecao_dados"
  | "registros_publicos";

export type OfficialLaw = {
  key: string;
  title: string;
  shortTitle: string;
  identifier: string;
  urn: string;
  kind: NormKind;
  authority: string;
  publishedAt: string; // yyyy-mm-dd
  sourceUrl: string;
  priority: number;
  aliases: string[];
  domainPacks: DomainPack[];
  /** Faixa esperada de artigos (após parse). */
  expectedArticleCount: { min: number; max: number };
  /**
   * Quando o parser falhar de forma confiável em uma versão (formatos
   * exóticos como CF/1988 com EC), marcamos `parserNotes` em vez de
   * cortar a lei.
   */
  parserNotes?: string;
};

/**
 * URN-LEX canônica:
 *   urn:lex:br:<authority>:<docType>:<yyyy-mm-dd>;<number>
 */

export const OFFICIAL_LAWS: OfficialLaw[] = [
  {
    key: "CF1988",
    title: "Constituição da República Federativa do Brasil de 1988",
    shortTitle: "Constituição Federal",
    identifier: "CF/1988",
    urn: "urn:lex:br:federal:constituicao:1988-10-05;1988",
    kind: NormKind.CONSTITUTION,
    authority: "Assembleia Nacional Constituinte",
    publishedAt: "1988-10-05",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/Constituicao/Constituicao.htm",
    priority: 100,
    aliases: ["constituição federal", "cf", "cf/88", "cf 1988", "constituição"],
    domainPacks: ["constitucional"],
    expectedArticleCount: { min: 280, max: 360 },
    parserNotes:
      "CF tem âncoras especiais para EC e ADCT. Contagem inclui artigos do ADCT e numerações -A/-B.",
  },
  {
    key: "CC2002",
    title: "Código Civil (Lei nº 10.406/2002)",
    shortTitle: "Código Civil",
    identifier: "Lei 10.406/2002",
    urn: "urn:lex:br:federal:lei:2002-01-10;10406",
    kind: NormKind.CODE,
    authority: "Congresso Nacional",
    publishedAt: "2002-01-10",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
    priority: 95,
    aliases: ["código civil", "cc", "cc/2002", "novo código civil"],
    domainPacks: ["civil", "familia"],
    expectedArticleCount: { min: 2000, max: 2150 },
  },
  {
    key: "CPC2015",
    title: "Código de Processo Civil (Lei nº 13.105/2015)",
    shortTitle: "Código de Processo Civil",
    identifier: "Lei 13.105/2015",
    urn: "urn:lex:br:federal:lei:2015-03-16;13105",
    kind: NormKind.CODE,
    authority: "Congresso Nacional",
    publishedAt: "2015-03-16",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
    priority: 95,
    aliases: ["cpc", "código de processo civil", "cpc/2015", "novo cpc"],
    domainPacks: ["processual_civil"],
    expectedArticleCount: { min: 1050, max: 1150 },
  },
  {
    key: "CDC",
    title: "Código de Defesa do Consumidor (Lei nº 8.078/1990)",
    shortTitle: "Código de Defesa do Consumidor",
    identifier: "Lei 8.078/1990",
    urn: "urn:lex:br:federal:lei:1990-09-11;8078",
    kind: NormKind.CODE,
    authority: "Congresso Nacional",
    publishedAt: "1990-09-11",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
    priority: 95,
    aliases: ["cdc", "código de defesa do consumidor", "código do consumidor"],
    domainPacks: ["consumidor", "civil"],
    expectedArticleCount: { min: 100, max: 130 },
  },
  {
    key: "CLT",
    title: "Consolidação das Leis do Trabalho (Decreto-Lei nº 5.452/1943)",
    shortTitle: "CLT",
    identifier: "Decreto-Lei 5.452/1943",
    urn: "urn:lex:br:federal:decreto-lei:1943-05-01;5452",
    kind: NormKind.CODE,
    authority: "Presidência da República",
    publishedAt: "1943-05-01",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm",
    priority: 90,
    aliases: ["clt", "consolidação das leis do trabalho", "leis trabalhistas"],
    domainPacks: ["trabalhista"],
    expectedArticleCount: { min: 1100, max: 1300 },
  },
  {
    key: "CP",
    title: "Código Penal (Decreto-Lei nº 2.848/1940)",
    shortTitle: "Código Penal",
    identifier: "Decreto-Lei 2.848/1940",
    urn: "urn:lex:br:federal:decreto-lei:1940-12-07;2848",
    kind: NormKind.CODE,
    authority: "Presidência da República",
    publishedAt: "1940-12-07",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
    priority: 90,
    aliases: ["cp", "código penal"],
    domainPacks: ["penal"],
    expectedArticleCount: { min: 360, max: 450 },
  },
  {
    key: "CPP",
    title: "Código de Processo Penal (Decreto-Lei nº 3.689/1941)",
    shortTitle: "Código de Processo Penal",
    identifier: "Decreto-Lei 3.689/1941",
    urn: "urn:lex:br:federal:decreto-lei:1941-10-03;3689",
    kind: NormKind.CODE,
    authority: "Presidência da República",
    publishedAt: "1941-10-03",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
    priority: 90,
    aliases: ["cpp", "código de processo penal"],
    domainPacks: ["processual_penal"],
    expectedArticleCount: { min: 800, max: 920 },
  },
  {
    key: "LMP",
    title: "Lei Maria da Penha (Lei nº 11.340/2006)",
    shortTitle: "Lei Maria da Penha",
    identifier: "Lei 11.340/2006",
    urn: "urn:lex:br:federal:lei:2006-08-07;11340",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "2006-08-07",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm",
    priority: 95,
    aliases: [
      "lei maria da penha",
      "maria da penha",
      "medida protetiva",
      "violência doméstica",
      "lei 11.340",
      "lei 11340",
    ],
    domainPacks: ["violencia_domestica", "penal", "familia"],
    expectedArticleCount: { min: 40, max: 60 },
  },
  {
    key: "ECA",
    title: "Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)",
    shortTitle: "ECA",
    identifier: "Lei 8.069/1990",
    urn: "urn:lex:br:federal:lei:1990-07-13;8069",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "1990-07-13",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8069compilado.htm",
    priority: 90,
    aliases: ["eca", "estatuto da criança", "estatuto do adolescente"],
    domainPacks: ["infancia_juventude", "familia"],
    expectedArticleCount: { min: 280, max: 340 },
  },
  {
    key: "EI",
    title: "Estatuto da Pessoa Idosa (Lei nº 10.741/2003)",
    shortTitle: "Estatuto da Pessoa Idosa",
    identifier: "Lei 10.741/2003",
    urn: "urn:lex:br:federal:lei:2003-10-01;10741",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "2003-10-01",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741compilado.htm",
    priority: 85,
    aliases: ["estatuto do idoso", "estatuto da pessoa idosa", "lei do idoso"],
    domainPacks: ["idoso", "familia", "civil"],
    expectedArticleCount: { min: 100, max: 130 },
  },
  {
    key: "EAOAB",
    title: "Estatuto da Advocacia e da OAB (Lei nº 8.906/1994)",
    shortTitle: "Estatuto da Advocacia",
    identifier: "Lei 8.906/1994",
    urn: "urn:lex:br:federal:lei:1994-07-04;8906",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "1994-07-04",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8906.htm",
    priority: 90,
    aliases: ["estatuto da advocacia", "estatuto da oab", "prerrogativas do advogado", "eaoab"],
    domainPacks: ["advocacia"],
    expectedArticleCount: { min: 85, max: 110 },
  },
  {
    key: "L8213",
    title: "Lei dos Benefícios da Previdência Social (Lei nº 8.213/1991)",
    shortTitle: "Lei de Benefícios Previdenciários",
    identifier: "Lei 8.213/1991",
    urn: "urn:lex:br:federal:lei:1991-07-24;8213",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "1991-07-24",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8213compilado.htm",
    priority: 85,
    aliases: [
      "lei 8.213",
      "lei de benefícios",
      "previdenciária",
      "benefício por incapacidade",
      "aposentadoria",
    ],
    domainPacks: ["previdenciario"],
    expectedArticleCount: { min: 150, max: 200 },
  },
  {
    key: "LINQ",
    title: "Lei do Inquilinato (Lei nº 8.245/1991)",
    shortTitle: "Lei do Inquilinato",
    identifier: "Lei 8.245/1991",
    urn: "urn:lex:br:federal:lei:1991-10-18;8245",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "1991-10-18",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8245.htm",
    priority: 80,
    aliases: ["lei do inquilinato", "locação", "lei 8.245", "despejo"],
    domainPacks: ["imobiliario_locacao", "civil"],
    expectedArticleCount: { min: 80, max: 100 },
  },
  {
    key: "LGPD",
    title: "Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018)",
    shortTitle: "LGPD",
    identifier: "Lei 13.709/2018",
    urn: "urn:lex:br:federal:lei:2018-08-14;13709",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "2018-08-14",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
    priority: 85,
    aliases: ["lgpd", "proteção de dados", "lei 13.709"],
    domainPacks: ["protecao_dados"],
    expectedArticleCount: { min: 65, max: 100 },
  },
  {
    key: "LRP",
    title: "Lei de Registros Públicos (Lei nº 6.015/1973)",
    shortTitle: "Lei de Registros Públicos",
    identifier: "Lei 6.015/1973",
    urn: "urn:lex:br:federal:lei:1973-12-31;6015",
    kind: NormKind.ORDINARY_LAW,
    authority: "Congresso Nacional",
    publishedAt: "1973-12-31",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
    priority: 75,
    aliases: ["registros públicos", "lei 6.015", "registro civil", "registro de imóveis"],
    domainPacks: ["registros_publicos", "civil"],
    expectedArticleCount: { min: 300, max: 400 },
  },
];

export const OFFICIAL_LAWS_BY_KEY: Record<string, OfficialLaw> = Object.fromEntries(
  OFFICIAL_LAWS.map((l) => [l.key, l]),
);

/** Encontra uma lei pelo key/identifier/alias (case-insensitive). */
export function findLawByQuery(q: string): OfficialLaw | undefined {
  const norm = q.trim().toLowerCase();
  return OFFICIAL_LAWS.find(
    (l) =>
      l.key.toLowerCase() === norm ||
      l.identifier.toLowerCase() === norm ||
      l.aliases.some((a) => a.toLowerCase() === norm),
  );
}

/** Filtra catálogo por lista de keys (vinda da CLI: --only=cpc,cdc,cc). */
export function filterLawsByKeys(keys: string[]): OfficialLaw[] {
  if (keys.length === 0) return OFFICIAL_LAWS;
  const upper = keys.map((k) => k.trim().toUpperCase());
  return OFFICIAL_LAWS.filter((l) => upper.includes(l.key.toUpperCase()));
}
