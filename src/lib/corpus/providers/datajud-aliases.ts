/**
 * DataJud — registro central de aliases por tribunal.
 *
 * O CNJ separa cada tribunal em um índice Elasticsearch público com alias
 * próprio. Lista oficial: https://datajud-wiki.cnj.jus.br/api-publica/endpoints
 *
 * Aqui mantemos uma lista curada com priorização para o Lex. Se um tribunal
 * adicional for necessário, basta acrescentar — o provider usa o alias como
 * string opaca.
 */

export type DatajudAliasEntry = {
  alias: string;
  /** Sigla canônica (ex.: "STJ", "TJSP", "TRF4"). */
  tribunal: string;
  /** Estado/UF quando aplicável. */
  uf?: string;
  /** Categoria do tribunal. */
  category:
    | "superior"
    | "trf"
    | "tjf"
    | "estadual"
    | "trabalho"
    | "eleitoral"
    | "militar";
  /** Quanto maior, mais prioritário para sync inicial. */
  priority: number;
  label: string;
};

export const DATAJUD_ALIASES: ReadonlyArray<DatajudAliasEntry> = [
  // ---- Superiores ----
  { alias: "api_publica_stj", tribunal: "STJ", category: "superior", priority: 100, label: "Superior Tribunal de Justiça" },
  { alias: "api_publica_tst", tribunal: "TST", category: "trabalho", priority: 95, label: "Tribunal Superior do Trabalho" },
  { alias: "api_publica_tse", tribunal: "TSE", category: "eleitoral", priority: 90, label: "Tribunal Superior Eleitoral" },
  { alias: "api_publica_stm", tribunal: "STM", category: "militar", priority: 60, label: "Superior Tribunal Militar" },

  // ---- TRFs ----
  { alias: "api_publica_trf1", tribunal: "TRF1", category: "trf", priority: 80, label: "Tribunal Regional Federal da 1ª Região" },
  { alias: "api_publica_trf2", tribunal: "TRF2", category: "trf", priority: 80, label: "Tribunal Regional Federal da 2ª Região" },
  { alias: "api_publica_trf3", tribunal: "TRF3", category: "trf", priority: 85, label: "Tribunal Regional Federal da 3ª Região" },
  { alias: "api_publica_trf4", tribunal: "TRF4", category: "trf", priority: 85, label: "Tribunal Regional Federal da 4ª Região" },
  { alias: "api_publica_trf5", tribunal: "TRF5", category: "trf", priority: 80, label: "Tribunal Regional Federal da 5ª Região" },
  { alias: "api_publica_trf6", tribunal: "TRF6", category: "trf", priority: 75, label: "Tribunal Regional Federal da 6ª Região" },

  // ---- TJs prioritários ----
  { alias: "api_publica_tjsp", tribunal: "TJSP", uf: "SP", category: "estadual", priority: 95, label: "Tribunal de Justiça de São Paulo" },
  { alias: "api_publica_tjrs", tribunal: "TJRS", uf: "RS", category: "estadual", priority: 85, label: "Tribunal de Justiça do Rio Grande do Sul" },
  { alias: "api_publica_tjpr", tribunal: "TJPR", uf: "PR", category: "estadual", priority: 80, label: "Tribunal de Justiça do Paraná" },
  { alias: "api_publica_tjsc", tribunal: "TJSC", uf: "SC", category: "estadual", priority: 80, label: "Tribunal de Justiça de Santa Catarina" },
  { alias: "api_publica_tjmg", tribunal: "TJMG", uf: "MG", category: "estadual", priority: 80, label: "Tribunal de Justiça de Minas Gerais" },
  { alias: "api_publica_tjrj", tribunal: "TJRJ", uf: "RJ", category: "estadual", priority: 80, label: "Tribunal de Justiça do Rio de Janeiro" },

  // ---- TRTs / TREs (alguns prioritários) ----
  { alias: "api_publica_trt12", tribunal: "TRT12", uf: "SC", category: "trabalho", priority: 60, label: "Tribunal Regional do Trabalho da 12ª Região" },
  { alias: "api_publica_tresc", tribunal: "TRE-SC", uf: "SC", category: "eleitoral", priority: 50, label: "Tribunal Regional Eleitoral de Santa Catarina" },
];

/** Busca metadata por alias. */
export function getAliasEntry(alias: string): DatajudAliasEntry | null {
  return DATAJUD_ALIASES.find((a) => a.alias === alias) ?? null;
}

/** Lista aliases ordenados por prioridade desc. */
export function listPriorityAliases(category?: DatajudAliasEntry["category"]): DatajudAliasEntry[] {
  const filtered = category
    ? DATAJUD_ALIASES.filter((a) => a.category === category)
    : [...DATAJUD_ALIASES];
  return filtered.sort((a, b) => b.priority - a.priority);
}
