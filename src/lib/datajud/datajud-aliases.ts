/**
 * DataJud — aliases oficiais da API Publica do CNJ.
 *
 * Fonte canônica: Wiki DataJud > API Publica DataJud > Endpoints.
 * Nao derive aliases a partir do codigo CNJ do tribunal. Resolva primeiro
 * uma sigla confiavel e, depois, consulte esta registry.
 */

export type DataJudAliasCategory =
  | "superior"
  | "trf"
  | "estadual"
  | "trabalho"
  | "eleitoral"
  | "militar"
  | "militar_estadual";

export type DataJudAliasEntry = {
  acronym: string;
  alias: string;
  category: DataJudAliasCategory;
  uf?: string;
  label: string;
  priority: number;
};

// Backwards-compatible names used by the older corpus provider module.
export type DatajudCategory = DataJudAliasCategory;
export type DatajudAliasEntry = DataJudAliasEntry & {
  /** Sigla canonica usada pelos filtros DataJud. */
  tribunal: string;
};

export const DATAJUD_OFFICIAL_ALIAS_BY_TRIBUNAL_ACRONYM = {
  TST: "api_publica_tst",
  TSE: "api_publica_tse",
  STJ: "api_publica_stj",
  STM: "api_publica_stm",

  TRF1: "api_publica_trf1",
  TRF2: "api_publica_trf2",
  TRF3: "api_publica_trf3",
  TRF4: "api_publica_trf4",
  TRF5: "api_publica_trf5",
  TRF6: "api_publica_trf6",

  TJAC: "api_publica_tjac",
  TJAL: "api_publica_tjal",
  TJAM: "api_publica_tjam",
  TJAP: "api_publica_tjap",
  TJBA: "api_publica_tjba",
  TJCE: "api_publica_tjce",
  TJDFT: "api_publica_tjdft",
  TJES: "api_publica_tjes",
  TJGO: "api_publica_tjgo",
  TJMA: "api_publica_tjma",
  TJMG: "api_publica_tjmg",
  TJMS: "api_publica_tjms",
  TJMT: "api_publica_tjmt",
  TJPA: "api_publica_tjpa",
  TJPB: "api_publica_tjpb",
  TJPE: "api_publica_tjpe",
  TJPI: "api_publica_tjpi",
  TJPR: "api_publica_tjpr",
  TJRJ: "api_publica_tjrj",
  TJRN: "api_publica_tjrn",
  TJRO: "api_publica_tjro",
  TJRR: "api_publica_tjrr",
  TJRS: "api_publica_tjrs",
  TJSC: "api_publica_tjsc",
  TJSE: "api_publica_tjse",
  TJSP: "api_publica_tjsp",
  TJTO: "api_publica_tjto",

  TRT1: "api_publica_trt1",
  TRT2: "api_publica_trt2",
  TRT3: "api_publica_trt3",
  TRT4: "api_publica_trt4",
  TRT5: "api_publica_trt5",
  TRT6: "api_publica_trt6",
  TRT7: "api_publica_trt7",
  TRT8: "api_publica_trt8",
  TRT9: "api_publica_trt9",
  TRT10: "api_publica_trt10",
  TRT11: "api_publica_trt11",
  TRT12: "api_publica_trt12",
  TRT13: "api_publica_trt13",
  TRT14: "api_publica_trt14",
  TRT15: "api_publica_trt15",
  TRT16: "api_publica_trt16",
  TRT17: "api_publica_trt17",
  TRT18: "api_publica_trt18",
  TRT19: "api_publica_trt19",
  TRT20: "api_publica_trt20",
  TRT21: "api_publica_trt21",
  TRT22: "api_publica_trt22",
  TRT23: "api_publica_trt23",
  TRT24: "api_publica_trt24",

  TRE_AC: "api_publica_tre-ac",
  TRE_AL: "api_publica_tre-al",
  TRE_AM: "api_publica_tre-am",
  TRE_AP: "api_publica_tre-ap",
  TRE_BA: "api_publica_tre-ba",
  TRE_CE: "api_publica_tre-ce",
  TRE_DFT: "api_publica_tre-df",
  TRE_ES: "api_publica_tre-es",
  TRE_GO: "api_publica_tre-go",
  TRE_MA: "api_publica_tre-ma",
  TRE_MG: "api_publica_tre-mg",
  TRE_MS: "api_publica_tre-ms",
  TRE_MT: "api_publica_tre-mt",
  TRE_PA: "api_publica_tre-pa",
  TRE_PB: "api_publica_tre-pb",
  TRE_PE: "api_publica_tre-pe",
  TRE_PI: "api_publica_tre-pi",
  TRE_PR: "api_publica_tre-pr",
  TRE_RJ: "api_publica_tre-rj",
  TRE_RN: "api_publica_tre-rn",
  TRE_RO: "api_publica_tre-ro",
  TRE_RR: "api_publica_tre-rr",
  TRE_RS: "api_publica_tre-rs",
  TRE_SC: "api_publica_tre-sc",
  TRE_SE: "api_publica_tre-se",
  TRE_SP: "api_publica_tre-sp",
  TRE_TO: "api_publica_tre-to",

  TJMMG: "api_publica_tjmmg",
  TJMRS: "api_publica_tjmrs",
  TJMSP: "api_publica_tjmsp",
} as const;

export type DataJudTribunalAcronym =
  keyof typeof DATAJUD_OFFICIAL_ALIAS_BY_TRIBUNAL_ACRONYM;

const TJ_CODE_TO_ACRONYM: Record<string, DataJudTribunalAcronym> = {
  "01": "TJAC",
  "02": "TJAL",
  "03": "TJAP",
  "04": "TJAM",
  "05": "TJBA",
  "06": "TJCE",
  "07": "TJDFT",
  "08": "TJES",
  "09": "TJGO",
  "10": "TJMA",
  "11": "TJMT",
  "12": "TJMS",
  "13": "TJMG",
  "14": "TJPA",
  "15": "TJPB",
  "16": "TJPR",
  "17": "TJPE",
  "18": "TJPI",
  "19": "TJRJ",
  "20": "TJRN",
  "21": "TJRS",
  "22": "TJRO",
  "23": "TJRR",
  "24": "TJSC",
  "25": "TJSE",
  "26": "TJSP",
  "27": "TJTO",
};

const TRE_CODE_TO_ACRONYM: Record<string, DataJudTribunalAcronym> = {
  "01": "TRE_AC",
  "02": "TRE_AL",
  "03": "TRE_AP",
  "04": "TRE_AM",
  "05": "TRE_BA",
  "06": "TRE_CE",
  "07": "TRE_DFT",
  "08": "TRE_ES",
  "09": "TRE_GO",
  "10": "TRE_MA",
  "11": "TRE_MT",
  "12": "TRE_MS",
  "13": "TRE_MG",
  "14": "TRE_PA",
  "15": "TRE_PB",
  "16": "TRE_PR",
  "17": "TRE_PE",
  "18": "TRE_PI",
  "19": "TRE_RJ",
  "20": "TRE_RN",
  "21": "TRE_RS",
  "22": "TRE_RO",
  "23": "TRE_RR",
  "24": "TRE_SC",
  "25": "TRE_SP",
  "26": "TRE_SE",
  "27": "TRE_TO",
};

const TJM_CODE_TO_ACRONYM: Record<string, DataJudTribunalAcronym> = {
  "13": "TJMMG",
  "21": "TJMRS",
  "26": "TJMSP",
};

function categoryFor(acronym: string): DataJudAliasCategory {
  if (["STJ", "TST", "TSE", "STM"].includes(acronym)) return "superior";
  if (acronym.startsWith("TRF")) return "trf";
  if (acronym.startsWith("TRT")) return "trabalho";
  if (acronym.startsWith("TRE_")) return "eleitoral";
  if (["TJMMG", "TJMRS", "TJMSP"].includes(acronym)) return "militar_estadual";
  return "estadual";
}

function labelFor(acronym: string): string {
  if (acronym === "STJ") return "Superior Tribunal de Justica";
  if (acronym === "TST") return "Tribunal Superior do Trabalho";
  if (acronym === "TSE") return "Tribunal Superior Eleitoral";
  if (acronym === "STM") return "Superior Tribunal Militar";
  if (acronym.startsWith("TRF")) return `Tribunal Regional Federal da ${acronym.slice(3)} Regiao`;
  if (acronym.startsWith("TRT")) return `Tribunal Regional do Trabalho da ${acronym.slice(3)} Regiao`;
  if (acronym.startsWith("TRE_")) return `Tribunal Regional Eleitoral ${acronym.slice(4)}`;
  if (["TJMMG", "TJMRS", "TJMSP"].includes(acronym)) {
    return `Tribunal de Justica Militar ${acronym.slice(3)}`;
  }
  return `Tribunal de Justica ${acronym.slice(2)}`;
}

function ufFor(acronym: string): string | undefined {
  if (acronym === "TJDFT" || acronym === "TRE_DFT") return "DF";
  if (acronym.startsWith("TJ") && acronym.length === 4) return acronym.slice(2);
  if (acronym.startsWith("TRE_")) return acronym.slice(4);
  if (acronym.startsWith("TJM") && acronym.length === 5) return acronym.slice(3);
  return undefined;
}

function normalizeDataJudTribunalAcronym(acronym: string): string {
  const normalized = acronym.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "_");
  const tjm = normalized.match(/^TJM_?([A-Z]{2})$/);
  if (tjm) return `TJM${tjm[1]}`;
  const tre = normalized.match(/^TRE_?([A-Z]{2,3})$/);
  if (tre) return `TRE_${tre[1] === "DF" ? "DFT" : tre[1]}`;
  return normalized;
}

function toTribunalFilter(acronym: string): string {
  return acronym.startsWith("TRE_") ? acronym.replace("_", "-") : acronym;
}

function priorityFor(acronym: string): number {
  if (acronym === "STJ") return 100;
  if (["TST", "TSE", "STM"].includes(acronym)) return 95;
  if (["TJSP", "TJRJ", "TJMG"].includes(acronym)) return 90;
  if (["TJRS", "TJSC", "TJPR", "TRF4"].includes(acronym)) return 85;
  return 60;
}

export const DATAJUD_ALIASES: ReadonlyArray<DatajudAliasEntry> = Object.entries(
  DATAJUD_OFFICIAL_ALIAS_BY_TRIBUNAL_ACRONYM,
).map(([acronym, alias]) => ({
  acronym,
  alias,
  category: categoryFor(acronym),
  ...(ufFor(acronym) ? { uf: ufFor(acronym) } : {}),
  label: labelFor(acronym),
  priority: priorityFor(acronym),
  tribunal: toTribunalFilter(acronym),
}));

export function resolveDataJudAliasFromTribunalAcronym(acronym: string): string | null {
  const normalized = normalizeDataJudTribunalAcronym(acronym);
  return (
    DATAJUD_OFFICIAL_ALIAS_BY_TRIBUNAL_ACRONYM[
      normalized as DataJudTribunalAcronym
    ] ?? null
  );
}

export function resolveDataJudAliasFromCnj(cnj: string): string | null {
  const digits = cnj.replace(/\D+/g, "");
  if (digits.length !== 20) return null;

  const segment = digits[13];
  const courtCode = digits.slice(14, 16);
  let acronym: DataJudTribunalAcronym | null = null;

  if (segment === "3" && courtCode === "00") acronym = "STJ";
  if (segment === "4") {
    const region = Number(courtCode);
    if (region >= 1 && region <= 6) acronym = `TRF${region}` as DataJudTribunalAcronym;
  }
  if (segment === "5") {
    if (courtCode === "00") acronym = "TST";
    else {
      const region = Number(courtCode);
      if (region >= 1 && region <= 24) acronym = `TRT${region}` as DataJudTribunalAcronym;
    }
  }
  if (segment === "6") {
    acronym = courtCode === "00" ? "TSE" : TRE_CODE_TO_ACRONYM[courtCode] ?? null;
  }
  if (segment === "7" && courtCode === "00") acronym = "STM";
  if (segment === "8") acronym = TJ_CODE_TO_ACRONYM[courtCode] ?? null;
  if (segment === "9") acronym = TJM_CODE_TO_ACRONYM[courtCode] ?? null;

  return acronym ? resolveDataJudAliasFromTribunalAcronym(acronym) : null;
}

export function getAliasEntry(alias: string): DatajudAliasEntry | null {
  return DATAJUD_ALIASES.find((entry) => entry.alias === alias) ?? null;
}

export function getAliasEntryByTribunalAcronym(acronym: string): DatajudAliasEntry | null {
  const alias = resolveDataJudAliasFromTribunalAcronym(acronym);
  return alias ? getAliasEntry(alias) : null;
}

export function getDataJudAliasByTribunal(acronym: string): string | null {
  return resolveDataJudAliasFromTribunalAcronym(acronym);
}

export function getDataJudAliasByTribunalAcronym(acronym: string): string | null {
  return resolveDataJudAliasFromTribunalAcronym(acronym);
}

export function getDataJudTribunals(): DatajudAliasEntry[] {
  return [...DATAJUD_ALIASES].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function listPriorityAliases(category?: DatajudCategory): DatajudAliasEntry[] {
  const aliases = category
    ? DATAJUD_ALIASES.filter((entry) => entry.category === category)
    : [...DATAJUD_ALIASES];
  return aliases.sort((a, b) => b.priority - a.priority);
}

export function aliasesByCategory(): Record<DatajudCategory, DatajudAliasEntry[]> {
  const grouped: Record<DatajudCategory, DatajudAliasEntry[]> = {
    superior: [],
    trf: [],
    estadual: [],
    trabalho: [],
    eleitoral: [],
    militar: [],
    militar_estadual: [],
  };
  for (const entry of DATAJUD_ALIASES) grouped[entry.category].push(entry);
  return grouped;
}

export const DATAJUD_ALIAS_TOTALS = {
  superiores: DATAJUD_ALIASES.filter((entry) => entry.category === "superior").length,
  trfs: DATAJUD_ALIASES.filter((entry) => entry.category === "trf").length,
  tjs: DATAJUD_ALIASES.filter((entry) => entry.category === "estadual").length,
  trts: DATAJUD_ALIASES.filter((entry) => entry.category === "trabalho").length,
  tres: DATAJUD_ALIASES.filter((entry) => entry.category === "eleitoral").length,
  tjms: DATAJUD_ALIASES.filter((entry) => entry.category === "militar_estadual").length,
  total: DATAJUD_ALIASES.length,
} as const;
