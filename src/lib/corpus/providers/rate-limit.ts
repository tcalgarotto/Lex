/**
 * Token-bucket simples por escopo (in-process). Usado nos providers HTTP
 * jurídicos (LexML, STF, STJ, DataJud) para evitar atravessar termos de uso
 * dos portais públicos.
 *
 * Não substitui o rate-limit de Redis (esse é por usuário/rota). Aqui é
 * apenas auto-proteção do worker contra bater nas APIs além do permitido.
 *
 * Política: sleep cooperativo até o próximo slot disponível. Se a janela
 * esgotou, espera o tempo necessário (max 5s para não pendurar testes).
 */

const buckets = new Map<
  string,
  { tokens: number; lastRefillMs: number; ratePerMinute: number; capacity: number }
>();

const MAX_WAIT_MS = 5_000;

export type RateLimitOptions = {
  scope: string;
  ratePerMinute: number;
  /** Se true, retorna imediatamente quando não há tokens (vs. sleep). */
  noWait?: boolean;
};

export type RateLimitDecision = {
  allowed: boolean;
  waitedMs: number;
  scope: string;
};

function refill(scope: string, ratePerMinute: number) {
  const now = Date.now();
  let b = buckets.get(scope);
  if (!b || b.ratePerMinute !== ratePerMinute) {
    b = {
      tokens: ratePerMinute,
      lastRefillMs: now,
      ratePerMinute,
      capacity: ratePerMinute,
    };
    buckets.set(scope, b);
    return b;
  }
  const elapsedMs = Math.max(0, now - b.lastRefillMs);
  if (elapsedMs > 0) {
    const tokensToAdd = (elapsedMs / 60_000) * ratePerMinute;
    b.tokens = Math.min(b.capacity, b.tokens + tokensToAdd);
    b.lastRefillMs = now;
  }
  return b;
}

/**
 * Adquire 1 token cooperativamente. Pode esperar até MAX_WAIT_MS.
 * Não lança — devolve `{allowed:false}` se não houver capacidade no prazo.
 */
export async function acquireProviderSlot(
  opts: RateLimitOptions,
): Promise<RateLimitDecision> {
  const start = Date.now();
  const b = refill(opts.scope, opts.ratePerMinute);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true, waitedMs: 0, scope: opts.scope };
  }
  if (opts.noWait) {
    return { allowed: false, waitedMs: 0, scope: opts.scope };
  }
  const tokensNeeded = 1 - b.tokens;
  const msPerToken = 60_000 / opts.ratePerMinute;
  const waitMs = Math.min(MAX_WAIT_MS, Math.ceil(tokensNeeded * msPerToken));
  await new Promise((r) => setTimeout(r, waitMs));
  const b2 = refill(opts.scope, opts.ratePerMinute);
  if (b2.tokens >= 1) {
    b2.tokens -= 1;
    return { allowed: true, waitedMs: Date.now() - start, scope: opts.scope };
  }
  return { allowed: false, waitedMs: Date.now() - start, scope: opts.scope };
}

/** Limpeza para testes. */
export function _resetProviderRateLimitForTests(): void {
  buckets.clear();
}
