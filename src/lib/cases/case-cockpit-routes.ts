/**
 * Rotas canônicas do Case Cockpit — sempre dentro de `/cases/[id]/…`.
 * Usar em CTAs, chips, dashboard e testes de regressão.
 */

export const CASE_COCKPIT_SEGMENTS = {
  overview: "",
  entrevista: "/entrevista",
  partesFatos: "/partes-fatos",
  documentos: "/documentos",
  pesquisa: "/pesquisa-juridica",
  estrategia: "/estrategia",
  pecas: "/pecas",
  processo: "/processo",
} as const;

export type CaseCockpitSegment = keyof typeof CASE_COCKPIT_SEGMENTS;

/** Href absoluto para uma seção do caso. */
export function caseCockpitHref(
  caseId: string,
  segment: CaseCockpitSegment,
  query?: Record<string, string>,
): string {
  const path = `/cases/${caseId}${CASE_COCKPIT_SEGMENTS[segment]}`;
  if (!query || Object.keys(query).length === 0) return path;
  const sp = new URLSearchParams(query);
  return `${path}?${sp.toString()}`;
}

/** Importar CNJ mantém returnCase — fluxo de processos externos ao cockpit. */
export function caseProcessImportHref(caseId: string): string {
  return `/processos?returnCase=${encodeURIComponent(caseId)}`;
}

/** Padrões proibidos em CTAs primários do fluxo do caso (sem contexto de caso). */
export const CASE_CTA_FORBIDDEN_HREF_PATTERNS = [
  /href\s*=\s*[`'"]\/strategy(?:\?|`|'|")/,
  /href\s*=\s*[`'"]\/pesquisa-juridica(?:\?|`|'|")/,
  /href\s*=\s*[`'"]\/processos(?:\?|`|'|")(?![^`'"]*returnCase)/,
] as const;
