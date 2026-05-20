/** Estados brasileiros (nome + sigla), ordem alfabética por nome. */
export const BR_UF_ENTRIES = [
  { name: "Acre", uf: "AC" },
  { name: "Alagoas", uf: "AL" },
  { name: "Amapá", uf: "AP" },
  { name: "Amazonas", uf: "AM" },
  { name: "Bahia", uf: "BA" },
  { name: "Ceará", uf: "CE" },
  { name: "Distrito Federal", uf: "DF" },
  { name: "Espírito Santo", uf: "ES" },
  { name: "Goiás", uf: "GO" },
  { name: "Maranhão", uf: "MA" },
  { name: "Mato Grosso", uf: "MT" },
  { name: "Mato Grosso do Sul", uf: "MS" },
  { name: "Minas Gerais", uf: "MG" },
  { name: "Pará", uf: "PA" },
  { name: "Paraíba", uf: "PB" },
  { name: "Paraná", uf: "PR" },
  { name: "Pernambuco", uf: "PE" },
  { name: "Piauí", uf: "PI" },
  { name: "Rio de Janeiro", uf: "RJ" },
  { name: "Rio Grande do Norte", uf: "RN" },
  { name: "Rio Grande do Sul", uf: "RS" },
  { name: "Rondônia", uf: "RO" },
  { name: "Roraima", uf: "RR" },
  { name: "Santa Catarina", uf: "SC" },
  { name: "São Paulo", uf: "SP" },
  { name: "Sergipe", uf: "SE" },
  { name: "Tocantins", uf: "TO" },
] as const;

const UF_SET = new Set(BR_UF_ENTRIES.map((e) => e.uf));

export function isValidBrUf(uf: string): boolean {
  const u = uf.trim().toUpperCase();
  return u.length === 2 && UF_SET.has(u as (typeof BR_UF_ENTRIES)[number]["uf"]);
}

export function formatUfLabel(uf: string): string {
  const u = uf.trim().toUpperCase();
  const entry = BR_UF_ENTRIES.find((e) => e.uf === u);
  return entry ? `${entry.name} — ${entry.uf}` : uf;
}

export function findUfByQuery(query: string): (typeof BR_UF_ENTRIES)[number] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (q.length === 2) {
    return BR_UF_ENTRIES.find((e) => e.uf.toLowerCase() === q) ?? null;
  }
  return (
    BR_UF_ENTRIES.find((e) => e.name.toLowerCase() === q) ??
    BR_UF_ENTRIES.find((e) => e.name.toLowerCase().startsWith(q)) ??
    null
  );
}
