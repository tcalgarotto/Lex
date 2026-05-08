/**
 * DataJud — registro completo dos aliases por tribunal (CNJ).
 *
 * Lista oficial (https://datajud-wiki.cnj.jus.br/api-publica/endpoints):
 *  -  4 Tribunais Superiores: STJ, TST, TSE, STM
 *  - 27 Tribunais de Justiça (TJs estaduais + TJDFT)
 *  -  6 Tribunais Regionais Federais (TRF1..6)
 *  - 24 Tribunais Regionais do Trabalho (TRT1..24)
 *  - 27 Tribunais Regionais Eleitorais (TREs)
 *  -  3 Tribunais de Justiça Militar Estaduais (TJM-MG, TJM-RS, TJM-SP)
 *
 *  TOTAL: 91 tribunais.
 *
 * Observação: STF NÃO está no DataJud (tem portal próprio — coberto pelo
 * provider `STF` do Lex que extrai súmulas/SVs).
 */

export type DatajudCategory =
  | "superior"
  | "trf"
  | "estadual"
  | "trabalho"
  | "eleitoral"
  | "militar"
  | "militar_estadual";

export type DatajudAliasEntry = {
  alias: string;
  /** Sigla canônica (ex.: "STJ", "TJSP", "TRF4", "TRT12", "TRE-SC", "TJM-MG"). */
  tribunal: string;
  /** Estado/UF quando aplicável. */
  uf?: string;
  /** Categoria do tribunal. */
  category: DatajudCategory;
  /** Quanto maior, mais prioritário para sync inicial. */
  priority: number;
  label: string;
};

// ----------------------------------------------------------------------
// 1. Superiores (4)
// ----------------------------------------------------------------------
const SUPERIORES: DatajudAliasEntry[] = [
  { alias: "api_publica_stj", tribunal: "STJ", category: "superior", priority: 100, label: "Superior Tribunal de Justiça" },
  { alias: "api_publica_tst", tribunal: "TST", category: "trabalho", priority: 99, label: "Tribunal Superior do Trabalho" },
  { alias: "api_publica_tse", tribunal: "TSE", category: "eleitoral", priority: 98, label: "Tribunal Superior Eleitoral" },
  { alias: "api_publica_stm", tribunal: "STM", category: "militar", priority: 97, label: "Superior Tribunal Militar" },
];

// ----------------------------------------------------------------------
// 2. Tribunais Regionais Federais (6)
// ----------------------------------------------------------------------
const TRFS: DatajudAliasEntry[] = [
  { alias: "api_publica_trf1", tribunal: "TRF1", category: "trf", priority: 90, label: "Tribunal Regional Federal da 1ª Região" },
  { alias: "api_publica_trf2", tribunal: "TRF2", category: "trf", priority: 90, label: "Tribunal Regional Federal da 2ª Região" },
  { alias: "api_publica_trf3", tribunal: "TRF3", category: "trf", priority: 90, label: "Tribunal Regional Federal da 3ª Região" },
  { alias: "api_publica_trf4", tribunal: "TRF4", category: "trf", priority: 90, label: "Tribunal Regional Federal da 4ª Região" },
  { alias: "api_publica_trf5", tribunal: "TRF5", category: "trf", priority: 90, label: "Tribunal Regional Federal da 5ª Região" },
  { alias: "api_publica_trf6", tribunal: "TRF6", category: "trf", priority: 90, label: "Tribunal Regional Federal da 6ª Região" },
];

// ----------------------------------------------------------------------
// 3. Tribunais de Justiça (27 = 26 estados + DF)
// ----------------------------------------------------------------------
const TJS: DatajudAliasEntry[] = [
  { alias: "api_publica_tjac",  tribunal: "TJAC",  uf: "AC", category: "estadual", priority: 70, label: "Tribunal de Justiça do Acre" },
  { alias: "api_publica_tjal",  tribunal: "TJAL",  uf: "AL", category: "estadual", priority: 72, label: "Tribunal de Justiça de Alagoas" },
  { alias: "api_publica_tjam",  tribunal: "TJAM",  uf: "AM", category: "estadual", priority: 72, label: "Tribunal de Justiça do Amazonas" },
  { alias: "api_publica_tjap",  tribunal: "TJAP",  uf: "AP", category: "estadual", priority: 70, label: "Tribunal de Justiça do Amapá" },
  { alias: "api_publica_tjba",  tribunal: "TJBA",  uf: "BA", category: "estadual", priority: 80, label: "Tribunal de Justiça da Bahia" },
  { alias: "api_publica_tjce",  tribunal: "TJCE",  uf: "CE", category: "estadual", priority: 78, label: "Tribunal de Justiça do Ceará" },
  { alias: "api_publica_tjdft", tribunal: "TJDFT", uf: "DF", category: "estadual", priority: 82, label: "Tribunal de Justiça do Distrito Federal e Territórios" },
  { alias: "api_publica_tjes",  tribunal: "TJES",  uf: "ES", category: "estadual", priority: 75, label: "Tribunal de Justiça do Espírito Santo" },
  { alias: "api_publica_tjgo",  tribunal: "TJGO",  uf: "GO", category: "estadual", priority: 78, label: "Tribunal de Justiça de Goiás" },
  { alias: "api_publica_tjma",  tribunal: "TJMA",  uf: "MA", category: "estadual", priority: 73, label: "Tribunal de Justiça do Maranhão" },
  { alias: "api_publica_tjmg",  tribunal: "TJMG",  uf: "MG", category: "estadual", priority: 92, label: "Tribunal de Justiça de Minas Gerais" },
  { alias: "api_publica_tjms",  tribunal: "TJMS",  uf: "MS", category: "estadual", priority: 73, label: "Tribunal de Justiça de Mato Grosso do Sul" },
  { alias: "api_publica_tjmt",  tribunal: "TJMT",  uf: "MT", category: "estadual", priority: 73, label: "Tribunal de Justiça de Mato Grosso" },
  { alias: "api_publica_tjpa",  tribunal: "TJPA",  uf: "PA", category: "estadual", priority: 75, label: "Tribunal de Justiça do Pará" },
  { alias: "api_publica_tjpb",  tribunal: "TJPB",  uf: "PB", category: "estadual", priority: 73, label: "Tribunal de Justiça da Paraíba" },
  { alias: "api_publica_tjpe",  tribunal: "TJPE",  uf: "PE", category: "estadual", priority: 80, label: "Tribunal de Justiça de Pernambuco" },
  { alias: "api_publica_tjpi",  tribunal: "TJPI",  uf: "PI", category: "estadual", priority: 70, label: "Tribunal de Justiça do Piauí" },
  { alias: "api_publica_tjpr",  tribunal: "TJPR",  uf: "PR", category: "estadual", priority: 88, label: "Tribunal de Justiça do Paraná" },
  { alias: "api_publica_tjrj",  tribunal: "TJRJ",  uf: "RJ", category: "estadual", priority: 90, label: "Tribunal de Justiça do Rio de Janeiro" },
  { alias: "api_publica_tjrn",  tribunal: "TJRN",  uf: "RN", category: "estadual", priority: 72, label: "Tribunal de Justiça do Rio Grande do Norte" },
  { alias: "api_publica_tjro",  tribunal: "TJRO",  uf: "RO", category: "estadual", priority: 70, label: "Tribunal de Justiça de Rondônia" },
  { alias: "api_publica_tjrr",  tribunal: "TJRR",  uf: "RR", category: "estadual", priority: 68, label: "Tribunal de Justiça de Roraima" },
  { alias: "api_publica_tjrs",  tribunal: "TJRS",  uf: "RS", category: "estadual", priority: 88, label: "Tribunal de Justiça do Rio Grande do Sul" },
  { alias: "api_publica_tjsc",  tribunal: "TJSC",  uf: "SC", category: "estadual", priority: 85, label: "Tribunal de Justiça de Santa Catarina" },
  { alias: "api_publica_tjse",  tribunal: "TJSE",  uf: "SE", category: "estadual", priority: 70, label: "Tribunal de Justiça de Sergipe" },
  { alias: "api_publica_tjsp",  tribunal: "TJSP",  uf: "SP", category: "estadual", priority: 95, label: "Tribunal de Justiça de São Paulo" },
  { alias: "api_publica_tjto",  tribunal: "TJTO",  uf: "TO", category: "estadual", priority: 70, label: "Tribunal de Justiça do Tocantins" },
];

// ----------------------------------------------------------------------
// 4. Tribunais Regionais do Trabalho (24)
// ----------------------------------------------------------------------
const TRTS: DatajudAliasEntry[] = [
  { alias: "api_publica_trt1",  tribunal: "TRT1",  uf: "RJ",     category: "trabalho", priority: 70, label: "Tribunal Regional do Trabalho da 1ª Região (RJ)" },
  { alias: "api_publica_trt2",  tribunal: "TRT2",  uf: "SP",     category: "trabalho", priority: 75, label: "Tribunal Regional do Trabalho da 2ª Região (SP capital)" },
  { alias: "api_publica_trt3",  tribunal: "TRT3",  uf: "MG",     category: "trabalho", priority: 70, label: "Tribunal Regional do Trabalho da 3ª Região (MG)" },
  { alias: "api_publica_trt4",  tribunal: "TRT4",  uf: "RS",     category: "trabalho", priority: 70, label: "Tribunal Regional do Trabalho da 4ª Região (RS)" },
  { alias: "api_publica_trt5",  tribunal: "TRT5",  uf: "BA",     category: "trabalho", priority: 65, label: "Tribunal Regional do Trabalho da 5ª Região (BA)" },
  { alias: "api_publica_trt6",  tribunal: "TRT6",  uf: "PE",     category: "trabalho", priority: 65, label: "Tribunal Regional do Trabalho da 6ª Região (PE)" },
  { alias: "api_publica_trt7",  tribunal: "TRT7",  uf: "CE",     category: "trabalho", priority: 65, label: "Tribunal Regional do Trabalho da 7ª Região (CE)" },
  { alias: "api_publica_trt8",  tribunal: "TRT8",  uf: "PA/AP",  category: "trabalho", priority: 65, label: "Tribunal Regional do Trabalho da 8ª Região (PA/AP)" },
  { alias: "api_publica_trt9",  tribunal: "TRT9",  uf: "PR",     category: "trabalho", priority: 70, label: "Tribunal Regional do Trabalho da 9ª Região (PR)" },
  { alias: "api_publica_trt10", tribunal: "TRT10", uf: "DF/TO",  category: "trabalho", priority: 70, label: "Tribunal Regional do Trabalho da 10ª Região (DF/TO)" },
  { alias: "api_publica_trt11", tribunal: "TRT11", uf: "AM/RR",  category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 11ª Região (AM/RR)" },
  { alias: "api_publica_trt12", tribunal: "TRT12", uf: "SC",     category: "trabalho", priority: 65, label: "Tribunal Regional do Trabalho da 12ª Região (SC)" },
  { alias: "api_publica_trt13", tribunal: "TRT13", uf: "PB",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 13ª Região (PB)" },
  { alias: "api_publica_trt14", tribunal: "TRT14", uf: "RO/AC",  category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 14ª Região (RO/AC)" },
  { alias: "api_publica_trt15", tribunal: "TRT15", uf: "SP",     category: "trabalho", priority: 75, label: "Tribunal Regional do Trabalho da 15ª Região (Campinas/SP interior)" },
  { alias: "api_publica_trt16", tribunal: "TRT16", uf: "MA",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 16ª Região (MA)" },
  { alias: "api_publica_trt17", tribunal: "TRT17", uf: "ES",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 17ª Região (ES)" },
  { alias: "api_publica_trt18", tribunal: "TRT18", uf: "GO",     category: "trabalho", priority: 65, label: "Tribunal Regional do Trabalho da 18ª Região (GO)" },
  { alias: "api_publica_trt19", tribunal: "TRT19", uf: "AL",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 19ª Região (AL)" },
  { alias: "api_publica_trt20", tribunal: "TRT20", uf: "SE",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 20ª Região (SE)" },
  { alias: "api_publica_trt21", tribunal: "TRT21", uf: "RN",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 21ª Região (RN)" },
  { alias: "api_publica_trt22", tribunal: "TRT22", uf: "PI",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 22ª Região (PI)" },
  { alias: "api_publica_trt23", tribunal: "TRT23", uf: "MT",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 23ª Região (MT)" },
  { alias: "api_publica_trt24", tribunal: "TRT24", uf: "MS",     category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 24ª Região (MS)" },
];

// ----------------------------------------------------------------------
// 5. Tribunais Regionais Eleitorais (27)
// ----------------------------------------------------------------------
const TRES: DatajudAliasEntry[] = [
  { alias: "api_publica_treac",  tribunal: "TRE-AC",  uf: "AC", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Acre" },
  { alias: "api_publica_treal",  tribunal: "TRE-AL",  uf: "AL", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral de Alagoas" },
  { alias: "api_publica_tream",  tribunal: "TRE-AM",  uf: "AM", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Amazonas" },
  { alias: "api_publica_treap",  tribunal: "TRE-AP",  uf: "AP", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Amapá" },
  { alias: "api_publica_treba",  tribunal: "TRE-BA",  uf: "BA", category: "eleitoral", priority: 55, label: "Tribunal Regional Eleitoral da Bahia" },
  { alias: "api_publica_trece",  tribunal: "TRE-CE",  uf: "CE", category: "eleitoral", priority: 55, label: "Tribunal Regional Eleitoral do Ceará" },
  { alias: "api_publica_tredft", tribunal: "TRE-DFT", uf: "DF", category: "eleitoral", priority: 55, label: "Tribunal Regional Eleitoral do Distrito Federal" },
  { alias: "api_publica_trees",  tribunal: "TRE-ES",  uf: "ES", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Espírito Santo" },
  { alias: "api_publica_trego",  tribunal: "TRE-GO",  uf: "GO", category: "eleitoral", priority: 55, label: "Tribunal Regional Eleitoral de Goiás" },
  { alias: "api_publica_trema",  tribunal: "TRE-MA",  uf: "MA", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Maranhão" },
  { alias: "api_publica_tremg",  tribunal: "TRE-MG",  uf: "MG", category: "eleitoral", priority: 60, label: "Tribunal Regional Eleitoral de Minas Gerais" },
  { alias: "api_publica_trems",  tribunal: "TRE-MS",  uf: "MS", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral de Mato Grosso do Sul" },
  { alias: "api_publica_tremt",  tribunal: "TRE-MT",  uf: "MT", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral de Mato Grosso" },
  { alias: "api_publica_trepa",  tribunal: "TRE-PA",  uf: "PA", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Pará" },
  { alias: "api_publica_trepb",  tribunal: "TRE-PB",  uf: "PB", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral da Paraíba" },
  { alias: "api_publica_trepe",  tribunal: "TRE-PE",  uf: "PE", category: "eleitoral", priority: 55, label: "Tribunal Regional Eleitoral de Pernambuco" },
  { alias: "api_publica_trepi",  tribunal: "TRE-PI",  uf: "PI", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Piauí" },
  { alias: "api_publica_trepr",  tribunal: "TRE-PR",  uf: "PR", category: "eleitoral", priority: 60, label: "Tribunal Regional Eleitoral do Paraná" },
  { alias: "api_publica_trerj",  tribunal: "TRE-RJ",  uf: "RJ", category: "eleitoral", priority: 60, label: "Tribunal Regional Eleitoral do Rio de Janeiro" },
  { alias: "api_publica_trern",  tribunal: "TRE-RN",  uf: "RN", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Rio Grande do Norte" },
  { alias: "api_publica_trero",  tribunal: "TRE-RO",  uf: "RO", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral de Rondônia" },
  { alias: "api_publica_trerr",  tribunal: "TRE-RR",  uf: "RR", category: "eleitoral", priority: 48, label: "Tribunal Regional Eleitoral de Roraima" },
  { alias: "api_publica_trers",  tribunal: "TRE-RS",  uf: "RS", category: "eleitoral", priority: 60, label: "Tribunal Regional Eleitoral do Rio Grande do Sul" },
  { alias: "api_publica_tresc",  tribunal: "TRE-SC",  uf: "SC", category: "eleitoral", priority: 55, label: "Tribunal Regional Eleitoral de Santa Catarina" },
  { alias: "api_publica_trese",  tribunal: "TRE-SE",  uf: "SE", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral de Sergipe" },
  { alias: "api_publica_tresp",  tribunal: "TRE-SP",  uf: "SP", category: "eleitoral", priority: 65, label: "Tribunal Regional Eleitoral de São Paulo" },
  { alias: "api_publica_treto",  tribunal: "TRE-TO",  uf: "TO", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral do Tocantins" },
];

// ----------------------------------------------------------------------
// 6. Tribunais de Justiça Militar Estaduais (3)
// (Apenas MG, RS e SP têm Justiça Militar Estadual constituída.)
// ----------------------------------------------------------------------
const TJMS: DatajudAliasEntry[] = [
  { alias: "api_publica_tjmmg", tribunal: "TJM-MG", uf: "MG", category: "militar_estadual", priority: 55, label: "Tribunal de Justiça Militar de Minas Gerais" },
  { alias: "api_publica_tjmrs", tribunal: "TJM-RS", uf: "RS", category: "militar_estadual", priority: 55, label: "Tribunal de Justiça Militar do Rio Grande do Sul" },
  { alias: "api_publica_tjmsp", tribunal: "TJM-SP", uf: "SP", category: "militar_estadual", priority: 55, label: "Tribunal de Justiça Militar de São Paulo" },
];

// ----------------------------------------------------------------------
// Lista canônica completa (91 tribunais).
// ----------------------------------------------------------------------
export const DATAJUD_ALIASES: ReadonlyArray<DatajudAliasEntry> = [
  ...SUPERIORES,
  ...TRFS,
  ...TJS,
  ...TRTS,
  ...TRES,
  ...TJMS,
];

/** Busca metadata por alias (case-sensitive, formato `api_publica_xxx`). */
export function getAliasEntry(alias: string): DatajudAliasEntry | null {
  return DATAJUD_ALIASES.find((a) => a.alias === alias) ?? null;
}

/**
 * Lista aliases ordenados por prioridade desc.
 * Quando `category` é informado, filtra por categoria.
 */
export function listPriorityAliases(category?: DatajudCategory): DatajudAliasEntry[] {
  const filtered = category
    ? DATAJUD_ALIASES.filter((a) => a.category === category)
    : [...DATAJUD_ALIASES];
  return filtered.sort((a, b) => b.priority - a.priority);
}

/** Lista todos os aliases agrupados por categoria. */
export function aliasesByCategory(): Record<DatajudCategory, DatajudAliasEntry[]> {
  const out: Record<DatajudCategory, DatajudAliasEntry[]> = {
    superior: [],
    trf: [],
    estadual: [],
    trabalho: [],
    eleitoral: [],
    militar: [],
    militar_estadual: [],
  };
  for (const a of DATAJUD_ALIASES) out[a.category].push(a);
  return out;
}

/**
 * Resumo numérico para docs/stats. Garante que mantemos paridade com o CNJ.
 */
export const DATAJUD_ALIAS_TOTALS = {
  superiores: SUPERIORES.length, // 4
  trfs: TRFS.length, //              6
  tjs: TJS.length, //                27
  trts: TRTS.length, //              24
  tres: TRES.length, //              27
  tjms: TJMS.length, //              3
  total: DATAJUD_ALIASES.length, //  91
} as const;
