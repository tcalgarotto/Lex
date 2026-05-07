/**
 * Rate limiter por janela fixa.
 *
 * - Apoiado em Redis quando disponível (`tryRedisCall` jamais propaga erro).
 * - **Fail-open silencioso**: se Redis estiver offline (dev sem cluster, ou
 *   queda transitória), o limiter libera a request — `getRedis()` já loga
 *   uma única vez via `warnOnce`. Não há mais spam.
 * - Em produção, `REDIS_REQUIRED=true` faz `/api/health` retornar 503 se
 *   Redis cair; o limiter continua liberando para não derrubar a UX.
 */

import { isRedisAvailable, tryRedisCall } from "@/lib/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  /** "redis" quando contou via Redis; "fail-open" quando Redis offline. */
  source: "redis" | "fail-open";
};

export async function rateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = params;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const ns = (process.env["REDIS_NAMESPACE"] ?? "lex").trim();
  const redisKey = `${ns}:rl:${key}:${bucket}`;
  const resetAt = (bucket + 1) * windowSeconds;

  if (!(await isRedisAvailable())) {
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
