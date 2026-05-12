/**
 * Cabeçalho `Server-Timing` só em desenvolvimento — não poluir produção.
 */
export function serverTimingHeader(parts: { name: string; dur: number }[]): HeadersInit {
  if (process.env.NODE_ENV !== "development" || parts.length === 0) return {};
  const value = parts.map((p) => `${p.name};dur=${Math.max(0, Math.round(p.dur))}`).join(", ");
  return { "Server-Timing": value };
}
