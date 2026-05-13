import {
  getAliasEntry,
  getAliasEntryByTribunalAcronym,
  resolveDataJudAliasFromCnj,
  resolveDataJudAliasFromTribunalAcronym,
  type DatajudAliasEntry,
} from "@/lib/datajud/datajud-aliases";

export type ParsedCnj = {
  raw: string;
  digits: string;
  formatted: string;
  sequential: string;
  checkDigits: string;
  year: string;
  segment: string;
  tribunalCode: string;
  originUnit: string;
  isValid: boolean;
  tribunalAcronym: string | null;
  tribunalAlias: string | null;
  tribunalEntry: DatajudAliasEntry | null;
  branch: string;
};

export type DataJudAliasResolution =
  | {
      ok: true;
      cnj: ParsedCnj;
      alias: string;
      tribunalAcronym: string;
      tribunalEntry: DatajudAliasEntry;
      source: "cnj" | "manual" | "fallback";
    }
  | {
      ok: false;
      reason: "invalid_cnj" | "unknown_tribunal" | "manual_selection_required";
      cnj: ParsedCnj | null;
      fallbackAlias: string | null;
    };

const SEGMENT_LABELS: Record<string, string> = {
  "1": "Supremo Tribunal Federal",
  "2": "Conselho Nacional de Justiça",
  "3": "Tribunais Superiores",
  "4": "Justiça Federal",
  "5": "Justiça do Trabalho",
  "6": "Justiça Eleitoral",
  "7": "Justiça Militar da União",
  "8": "Justiça Estadual",
  "9": "Justiça Militar Estadual",
};

function cnjModulo97(value: string): number {
  let remainder = 0;
  for (const char of value) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return remainder;
}

export function onlyCnjDigits(input: string): string {
  return input.replace(/\D+/g, "");
}

export function formatCnj(input: string): string {
  const digits = onlyCnjDigits(input);
  if (digits.length !== 20) return input.trim();
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

export function isValidCnj(input: string): boolean {
  const digits = onlyCnjDigits(input);
  if (digits.length !== 20) return false;
  const base = `${digits.slice(0, 7)}${digits.slice(9, 20)}00`;
  const expected = String(98 - cnjModulo97(base)).padStart(2, "0");
  return expected === digits.slice(7, 9);
}

export function parseCnj(input: string): ParsedCnj | null {
  const digits = onlyCnjDigits(input);
  if (digits.length !== 20) return null;

  const alias = resolveDataJudAliasFromCnj(digits);
  const entry = alias ? getAliasEntry(alias) : null;

  return {
    raw: input,
    digits,
    formatted: formatCnj(digits),
    sequential: digits.slice(0, 7),
    checkDigits: digits.slice(7, 9),
    year: digits.slice(9, 13),
    segment: digits.slice(13, 14),
    tribunalCode: digits.slice(14, 16),
    originUnit: digits.slice(16, 20),
    isValid: isValidCnj(digits),
    tribunalAcronym: entry?.acronym ?? null,
    tribunalAlias: alias,
    tribunalEntry: entry,
    branch: SEGMENT_LABELS[digits.slice(13, 14)] ?? "Ramo judicial não identificado",
  };
}

export function resolveDataJudAlias(args: {
  cnj?: string | null;
  tribunalAcronym?: string | null;
  fallbackAlias?: string | null;
}): DataJudAliasResolution {
  const parsed = args.cnj ? parseCnj(args.cnj) : null;
  if (args.cnj && (!parsed || !parsed.isValid)) {
    return {
      ok: false,
      reason: "invalid_cnj",
      cnj: parsed,
      fallbackAlias: args.fallbackAlias?.trim() || null,
    };
  }

  if (parsed?.tribunalAlias && parsed.tribunalEntry) {
    return {
      ok: true,
      cnj: parsed,
      alias: parsed.tribunalAlias,
      tribunalAcronym: parsed.tribunalEntry.acronym,
      tribunalEntry: parsed.tribunalEntry,
      source: "cnj",
    };
  }

  if (args.tribunalAcronym?.trim()) {
    const alias = resolveDataJudAliasFromTribunalAcronym(args.tribunalAcronym);
    const entry = alias ? getAliasEntryByTribunalAcronym(args.tribunalAcronym) : null;
    if (alias && entry && parsed) {
      return {
        ok: true,
        cnj: { ...parsed, tribunalAlias: alias, tribunalAcronym: entry.acronym, tribunalEntry: entry },
        alias,
        tribunalAcronym: entry.acronym,
        tribunalEntry: entry,
        source: "manual",
      };
    }
  }

  if (parsed && args.fallbackAlias?.trim()) {
    const entry = getAliasEntry(args.fallbackAlias.trim());
    if (entry) {
      return {
        ok: true,
        cnj: {
          ...parsed,
          tribunalAlias: entry.alias,
          tribunalAcronym: entry.acronym,
          tribunalEntry: entry,
        },
        alias: entry.alias,
        tribunalAcronym: entry.acronym,
        tribunalEntry: entry,
        source: "fallback",
      };
    }
  }

  return {
    ok: false,
    reason: parsed ? "unknown_tribunal" : "manual_selection_required",
    cnj: parsed,
    fallbackAlias: args.fallbackAlias?.trim() || null,
  };
}
