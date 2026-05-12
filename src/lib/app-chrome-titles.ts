/**
 * Fallback de título da topbar por URL (rotas sem `SetPageTitle`).
 * Prefixos mais específicos primeiro.
 */
const PREFIX_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/settings/readiness", title: "Prontidão do ambiente" },
  { prefix: "/settings/admin", title: "Admin — custos e observabilidade" },
  { prefix: "/settings/estilo", title: "Perfil de escrita" },
  { prefix: "/settings/roteiros", title: "Roteiros de entrevista" },
  { prefix: "/settings/perfil", title: "Perfil" },
  { prefix: "/settings/jobs", title: "Jobs IA" },
  { prefix: "/settings/team", title: "Equipe" },
  { prefix: "/biblioteca/fundamentos/novo", title: "Novo fundamento" },
  { prefix: "/biblioteca/memoria", title: "Memória do workspace" },
  { prefix: "/biblioteca/documentos/", title: "Documento" },
  { prefix: "/biblioteca/fundamentos/", title: "Fundamento" },
  { prefix: "/biblioteca", title: "Biblioteca" },
  { prefix: "/cases/new", title: "Novo caso" },
  { prefix: "/documentos", title: "Documentos" },
  { prefix: "/pesquisa-juridica", title: "Pesquisa jurídica" },
  { prefix: "/retrieval/explain", title: "Retrieval auditável" },
  { prefix: "/processos/", title: "Processo" },
  { prefix: "/processos", title: "Processos judiciais" },
  { prefix: "/editor/", title: "Peça" },
  { prefix: "/editor", title: "Peças" },
  { prefix: "/cases/", title: "Caso" },
  { prefix: "/cases", title: "Casos" },
  { prefix: "/cockpit", title: "Cockpit operacional" },
  { prefix: "/strategy", title: "Estratégia jurídica" },
  { prefix: "/test-guide", title: "Roteiro de teste" },
  { prefix: "/demo", title: "Modo demonstração" },
  { prefix: "/busca", title: "Busca" },
  { prefix: "/apresentacao", title: "Apresentação" },
  { prefix: "/dashboard", title: "Briefing matinal" },
];

export function matchPathTitle(pathname: string): string {
  const n = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (/^\/processos\/[^/]+\/documentos\//.test(n)) return "Documento";
  for (const { prefix, title } of PREFIX_TITLES) {
    if (n === prefix || n.startsWith(`${prefix}/`)) return title;
  }
  return "Lex";
}
