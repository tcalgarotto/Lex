/**
 * Rate limiter por janela fixa.
 *
 * - Apoiado em Redis quando disponível (`tryRedisCall` jamais propaga erro).
 * - Rotas **leves** (`tier: "default"`): fail-open se Redis offline (dev UX).
 * - Rotas **caras** (`tier: "expensive"`): fail-closed quando Redis offline e
 *   `REDIS_REQUIRED`, `RATE_LIMIT_FAIL_CLOSED` ou `NODE_ENV=production`.
 * - `RATE_LIMIT_FAIL_OPEN_DEV=1` força fail-open em dev mesmo para rotas caras
 *   (testes locais sem Redis).
 */

import { isRedisAvailable, tryRedisCall } from "@/lib/redis";

export type RateLimitTier = "default" | "expensive";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  /** redis | fail-open (leve) | fail-closed (cara sem Redis) */
  source: "redis" | "fail-open" | "fail-closed";
};

/** Rotas caras devem bloquear sem Redis em prod ou quando env exige. */
export function isRateLimitFailClosedActive(): boolean {
  const forceOpen =
    process.env["RATE_LIMIT_FAIL_OPEN_DEV"] === "1" ||
    process.env["RATE_LIMIT_FAIL_OPEN_DEV"] === "true";
  if (forceOpen) return false;
  if (process.env["RATE_LIMIT_FAIL_CLOSED"] === "1") return true;
  if (process.env["RATE_LIMIT_FAIL_CLOSED"] === "true") return true;
  if (process.env["REDIS_REQUIRED"] === "true") return true;
  return process.env["NODE_ENV"] === "production";
}

export async function rateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
  tier?: RateLimitTier;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, tier = "default" } = params;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const ns = (process.env["REDIS_NAMESPACE"] ?? "lex").trim();
  const redisKey = `${ns}:rl:${key}:${bucket}`;
  const resetAt = (bucket + 1) * windowSeconds;

  if (!(await isRedisAvailable())) {
    if (tier === "expensive" && isRateLimitFailClosedActive()) {
      return { allowed: false, remaining: 0, resetAt, limit, source: "fail-closed" };
    }
    return { allowed: true, remaining: limit, resetAt, limit, source: "fail-open" };
  }

  const count = await tryRedisCall(
    async (r) => {
      const pipe = r.multi();
      pipe.incr(redisKey);
      pipe.expire(redisKey, windowSeconds);
      const result = await pipe.exec();
      if (Array.isArray(result) && result[0] && typeof result[0][1] === "number") {
        return result[0][1] as number;
      }
      return 1;
    },
    /* fallback */ -1,
    "rate-limit",
  );

  if (count < 0) {
    if (tier === "expensive" && isRateLimitFailClosedActive()) {
      return { allowed: false, remaining: 0, resetAt, limit, source: "fail-closed" };
    }
    return { allowed: true, remaining: limit, resetAt, limit, source: "fail-open" };
  }

  if (count > limit) {
    return { allowed: false, remaining: 0, resetAt, limit, source: "redis" };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limit - count),
    resetAt,
    limit,
    source: "redis",
  };
}

/**
 * Extrai o IP melhor que conseguirmos a partir dos headers Next.js.
 * Em produção (Vercel), `x-forwarded-for` vem populado.
 */
export function getRequestIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    "X-RateLimit-Source": result.source,
  };
}

/** Status HTTP quando rate limit bloqueia (fail-closed sem Redis → 503). */
export function rateLimitHttpStatus(result: RateLimitResult): number {
  if (result.allowed) return 200;
  return result.source === "fail-closed" ? 503 : 429;
}
