/** Estimativas USD aproximadas por 1M tokens (entrada/saída) — ajuste conforme tabela comercial. */
const DEFAULT_RATE = { in: 0.5, out: 1.5 };
const RATES_PER_MTOK: Record<string, { in: number; out: number }> = {
  "deepseek-chat": { in: 0.14, out: 0.28 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "claude-3-5-sonnet-20241022": { in: 3, out: 15 },
};

export function estimateLlmCostUsd(params: {
  modelId: string;
  promptTokens?: number;
  completionTokens?: number;
}): number | null {
  const pin = params.promptTokens ?? 0;
  const cout = params.completionTokens ?? 0;
  if (!pin && !cout) return null;
  const r = RATES_PER_MTOK[params.modelId] ?? DEFAULT_RATE;
  return (pin / 1_000_000) * r.in + (cout / 1_000_000) * r.out;
}
