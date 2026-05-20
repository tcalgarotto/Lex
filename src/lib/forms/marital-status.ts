export const MARITAL_STATUS_OPTIONS = [
  { value: "nao_informado", label: "Não informado" },
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "uniao_estavel", label: "União estável" },
  { value: "separado", label: "Separado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
] as const;

export type MaritalStatusValue = (typeof MARITAL_STATUS_OPTIONS)[number]["value"];

const VALUES = new Set<string>(MARITAL_STATUS_OPTIONS.map((o) => o.value));

export function isValidMaritalStatus(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return VALUES.has(v);
}

export function maritalStatusLabel(value: string): string {
  const v = value.trim() || "nao_informado";
  return MARITAL_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? "Não informado";
}

export function normalizeMaritalStatus(value: string): MaritalStatusValue {
  const v = value.trim();
  if (!v || !VALUES.has(v)) return "nao_informado";
  return v as MaritalStatusValue;
}
