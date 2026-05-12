/**
 * Cabeçalho `Server-Timing` só em desenvolvimento — não poluir produção.
 */
export function serverTimingHeader(parts: { name: string; dur: number }[]): HeadersInit {
  if (process.env.NODE_ENV !== "development" || parts.length === 0) return {};
  const value = parts.map((p) => `${p.name};dur=${Math.max(0, Math.round(p.dur))}`).join(", ");
  return { "Server-Timing": value };
}

/** Log discreto de fases em dev (RSC / rotas). Não usar em produção. */
export function devLogLexTiming(label: string, ms: number): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[lex timing] ${label} ${Math.round(Math.max(0, ms))}ms`);
}
