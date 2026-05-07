/**
 * Catálogo nacional de tribunais brasileiros para o corpus jurídico do Lex.
 *
 * Cobre 92 tribunais:
 *   - 4 superiores (STF, STJ, TST, TSE)
 *   - 5 TRFs (1ª–5ª Região)
 *   - 24 TRTs (1ª–24ª Região)
 *   - 27 TJs (estaduais + DF)
 *   - 27 TREs (eleitorais regionais)
 *   - militares e federal de 6ª região (placeholder pra expansão)
 *
 * Cada entrada normaliza:
 *   - `code`: sigla canônica (ex.: "TJSP", "TRF4").
 *   - `urnAuthority`: forma usada nas URN-LEX (`tribunal.justica.sao.paulo`).
 *   - `tier`: tipo hierárquico (superior, regional federal, regional do trabalho,
 *     estadual, regional eleitoral).
 *   - `jurisdiction`: enum NormJurisdiction usado no schema.
 *   - `uf`: UF principal quando aplicável.
 *   - `circuit`: número da região quando aplicável (TRF, TRT, TRE).
 */

import { NormJurisdiction } from "@prisma/client";

export type TribunalTier =
  | "SUPERIOR"
  | "TRF" // Tribunal Regional Federal
  | "TRT" // Tribunal Regional do Trabalho
  | "TJ" // Tribunal de Justiça (estadual + DF)
  | "TRE" // Tribunal Regional Eleitoral
  | "TJM"; // Tribunal de Justiça Militar (estadual: SP, RS, MG) + STM (superior)

export type TribunalEntry = {
  code: string;
  name: string;
  tier: TribunalTier;
  urnAuthority: string;
  jurisdiction: NormJurisdiction;
  uf?: string;
  circuit?: number;
};

/* ----------------------------- Superiores ------------------------------ */

const SUPERIORES: TribunalEntry[] = [
  {
    code: "STF",
    name: "Supremo Tribunal Federal",
    tier: "SUPERIOR",
    urnAuthority: "supremo.tribunal.federal",
    jurisdiction: NormJurisdiction.COURT,
  },
  {
    code: "STJ",
    name: "Superior Tribunal de Justiça",
    tier: "SUPERIOR",
    urnAuthority: "superior.tribunal.justica",
    jurisdiction: NormJurisdiction.COURT,
  },
  {
    code: "TST",
    name: "Tribunal Superior do Trabalho",
    tier: "SUPERIOR",
    urnAuthority: "tribunal.superior.trabalho",
    jurisdiction: NormJurisdiction.COURT,
  },
  {
    code: "TSE",
    name: "Tribunal Superior Eleitoral",
    tier: "SUPERIOR",
    urnAuthority: "tribunal.superior.eleitoral",
    jurisdiction: NormJurisdiction.COURT,
  },
  {
    code: "STM",
    name: "Superior Tribunal Militar",
    tier: "SUPERIOR",
    urnAuthority: "superior.tribunal.militar",
    jurisdiction: NormJurisdiction.COURT,
  },
];

const TJMS: TribunalEntry[] = [
  { code: "TJMSP", name: "Tribunal de Justiça Militar de São Paulo", tier: "TJM", urnAuthority: "tribunal.justica.militar.sao.paulo", jurisdiction: NormJurisdiction.STATE, uf: "SP" },
  { code: "TJMRS", name: "Tribunal de Justiça Militar do Rio Grande do Sul", tier: "TJM", urnAuthority: "tribunal.justica.militar.rio.grande.do.sul", jurisdiction: NormJurisdiction.STATE, uf: "RS" },
  { code: "TJMMG", name: "Tribunal de Justiça Militar de Minas Gerais", tier: "TJM", urnAuthority: "tribunal.justica.militar.minas.gerais", jurisdiction: NormJurisdiction.STATE, uf: "MG" },
];

/* -------------------------------- TRFs --------------------------------- */

const TRF_REGIONS = [
  { circuit: 1, hub: "DF", name: "1ª Região" },
  { circuit: 2, hub: "RJ", name: "2ª Região" },
  { circuit: 3, hub: "SP", name: "3ª Região" },
  { circuit: 4, hub: "RS", name: "4ª Região" },
  { circuit: 5, hub: "PE", name: "5ª Região" },
  { circuit: 6, hub: "MG", name: "6ª Região" },
];

const TRFS: TribunalEntry[] = TRF_REGIONS.map((r) => ({
  code: `TRF${r.circuit}`,
  name: `Tribunal Regional Federal da ${r.name}`,
  tier: "TRF",
  urnAuthority: `tribunal.regional.federal.${r.circuit}`,
  jurisdiction: NormJurisdiction.COURT,
  uf: r.hub,
  circuit: r.circuit,
}));

/* -------------------------------- TRTs --------------------------------- */

const TRT_REGIONS = [
  ["RJ", 1],
  ["SP", 2], // capital
  ["MG", 3],
  ["RS", 4],
  ["BA", 5],
  ["PE", 6],
  ["CE", 7],
  ["PA", 8],
  ["PR", 9],
  ["DF", 10],
  ["AM", 11],
  ["SC", 12],
  ["PB", 13],
  ["RN", 14],
  ["SP", 15], // interior
  ["MA", 16],
  ["ES", 17],
  ["GO", 18],
  ["AL", 19],
  ["SE", 20],
  ["MT", 23],
  ["MS", 24],
  ["PI", 22],
  ["RO", 14], // RO + AC compartilham 14? não — TRT-14 é RO+AC
] as const;

// Lista canônica TRT 1..24, mapping correto.
const TRT_MAP: Array<[string, number]> = [
  ["RJ", 1],
  ["SP", 2],
  ["MG", 3],
  ["RS", 4],
  ["BA", 5],
  ["PE", 6],
  ["CE", 7],
  ["PA", 8], // + AP
  ["PR", 9],
  ["DF", 10], // + TO
  ["AM", 11], // + RR
  ["SC", 12],
  ["PB", 13],
  ["RO", 14], // + AC
  ["SP", 15], // Campinas
  ["MA", 16],
  ["ES", 17],
  ["GO", 18],
  ["AL", 19],
  ["SE", 20],
  ["RN", 21],
  ["PI", 22],
  ["MT", 23],
  ["MS", 24],
];
void TRT_REGIONS; // alias mantido apenas para legibilidade na documentação

const TRTS: TribunalEntry[] = TRT_MAP.map(([uf, circuit]) => ({
  code: `TRT${circuit}`,
  name: `Tribunal Regional do Trabalho da ${circuit}ª Região`,
  tier: "TRT",
  urnAuthority: `tribunal.regional.trabalho.${circuit}`,
  jurisdiction: NormJurisdiction.COURT,
  uf,
  circuit,
}));

/* -------------------------------- TJs ---------------------------------- */

const UFS_27 = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const UF_NAMES: Record<(typeof UFS_27)[number], string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

const TJS: TribunalEntry[] = UFS_27.map((uf) => ({
  code: `TJ${uf}`,
  name: `Tribunal de Justiça d${uf === "DF" ? "o " : "e "}${UF_NAMES[uf]}`,
  tier: "TJ",
  urnAuthority: `tribunal.justica.${normalizeAuthority(UF_NAMES[uf])}`,
  jurisdiction: uf === "DF" ? NormJurisdiction.FEDERAL : NormJurisdiction.STATE,
  uf,
}));

/* ------------------------------- TREs ---------------------------------- */

const TRES: TribunalEntry[] = UFS_27.map((uf, idx) => ({
  code: `TRE${uf}`,
  name: `Tribunal Regional Eleitoral d${uf === "DF" ? "o " : "e "}${UF_NAMES[uf]}`,
  tier: "TRE",
  urnAuthority: `tribunal.regional.eleitoral.${normalizeAuthority(UF_NAMES[uf])}`,
  jurisdiction: NormJurisdiction.COURT,
  uf,
  circuit: idx + 1, // não-canônico, apenas determinismo
}));

/* ---------------------------- catálogo final --------------------------- */

export const TRIBUNALS: readonly TribunalEntry[] = [
  ...SUPERIORES,
  ...TRFS,
  ...TRTS,
  ...TJS,
  ...TRES,
  ...TJMS,
] as const;

const BY_CODE = new Map<string, TribunalEntry>(TRIBUNALS.map((t) => [t.code, t]));
const BY_TIER = groupBy(TRIBUNALS, (t) => t.tier);
const BY_UF = groupBy(
  TRIBUNALS.filter((t) => !!t.uf),
  (t) => t.uf!,
);

export function getTribunal(code: string): TribunalEntry | null {
  return BY_CODE.get(code.toUpperCase()) ?? null;
}

export function tribunalsByTier(tier: TribunalTier): TribunalEntry[] {
  return BY_TIER.get(tier) ?? [];
}

export function tribunalsByUf(uf: string): TribunalEntry[] {
  return BY_UF.get(uf.toUpperCase()) ?? [];
}

export function listTribunalCodes(): string[] {
  return TRIBUNALS.map((t) => t.code);
}

/** Retorna a sigla "primária" (TRF/TRT/TRE) ou o próprio TJ a partir de uma UF. */
export function primaryRegionalForUf(uf: string): {
  tj: TribunalEntry | null;
  trf: TribunalEntry | null;
  trt: TribunalEntry | null;
  tre: TribunalEntry | null;
} {
  const u = uf.toUpperCase();
  return {
    tj: BY_UF.get(u)?.find((t) => t.tier === "TJ") ?? null,
    trf: BY_UF.get(u)?.find((t) => t.tier === "TRF") ?? null,
    trt: BY_UF.get(u)?.find((t) => t.tier === "TRT") ?? null,
    tre: BY_UF.get(u)?.find((t) => t.tier === "TRE") ?? null,
  };
}

/* ------------------------------ helpers ------------------------------- */

function normalizeAuthority(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function groupBy<T, K>(arr: readonly T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}
