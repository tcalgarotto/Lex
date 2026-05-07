/**
 * Health check com semântica clara para produção.
 *
 * Status retornado:
 *  - `ok`        — tudo verde.
 *  - `degraded`  — algum check OPCIONAL caiu (Redis, Qdrant), app continua útil.
 *  - `down`      — algum check CRÍTICO caiu (DB, Supabase Auth) → HTTP 503.
 *
 * Critérios:
 *  - DB e Supabase Auth são SEMPRE críticos.
 *  - Redis é crítico apenas quando `REDIS_REQUIRED=true` (default em produção).
 *  - Qdrant é crítico apenas quando `QDRANT_REQUIRED=true` (default em produção).
 *
 * Liveness ≠ Readiness:
 *  - `/api/ready` (liveness): processo bootou. Não toca dependências.
 *  - `/api/health` (readiness): toca todas as dependências externas.
 *
 * O endpoint nunca lança — sempre devolve JSON estável (200 ou 503).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis, isRedisAvailable, isRedisRequired } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  ok: boolean;
  required: boolean;
  latencyMs: number;
  error?: string;
};

async function checkWithTimeout(
  label: string,
  required: boolean,
  fn: () => Promise<unknown>,
  timeoutMs: number,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { ok: true, required, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      required,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function isQdrantRequired(): boolean {
  const flag = (process.env["QDRANT_REQUIRED"] ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env["NODE_ENV"] === "production";
}

export async function GET() {
  const redisRequired = isRedisRequired();
  const qdrantRequired = isQdrantRequired();

  const [db, redis, qdrant, supabase] = await Promise.all([
    checkWithTimeout(
      "db",
      true,
      () => prisma.$queryRawUnsafe("SELECT 1"),
      3_000,
    ),
    checkWithTimeout(
      "redis",
      redisRequired,
      async () => {
        const r = getRedis();
        if (!r) {
          if (redisRequired) throw new Error("REDIS_URL ausente");
          return; // dev opcional: ok
        }
        const available = await isRedisAvailable();
        if (!available) {
          if (redisRequired) throw new Error("redis ping falhou");
          return; // degraded mas não bloqueia em dev
        }
      },
      1_500,
    ),
    checkWithTimeout(
      "qdrant",
      qdrantRequired,
      async () => {
        const url = process.env["QDRANT_URL"];
        if (!url) {
          if (qdrantRequired) throw new Error("QDRANT_URL ausente");
          return;
        }
        const headers: Record<string, string> = {};
        const apiKey = process.env["QDRANT_API_KEY"];
        if (apiKey) headers["api-key"] = apiKey;
        const res = await fetch(`${url}/readyz`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error(`qdrant /readyz ${res.status}`);
      },
      2_500,
    ),
    checkWithTimeout(
      "supabase",
      true,
      async () => {
        const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
        const anon = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
        if (!url || !anon) throw new Error("Supabase URL/ANON ausentes");
        const res = await fetch(`${url}/auth/v1/health`, {
          cache: "no-store",
          headers: { apikey: anon },
        });
        if (!res.ok) throw new Error(`supabase auth /health ${res.status}`);
      },
      2_500,
    ),
  ]);

  const checks = { db, redis, qdrant, supabase };
  const criticalDown = Object.values(checks).some((c) => c.required && !c.ok);
  const anyDown = Object.values(checks).some((c) => !c.ok);

  let status: "ok" | "degraded" | "down";
  let httpStatus: number;
  if (criticalDown) {
    status = "down";
    httpStatus = 503;
  } else if (anyDown) {
    status = "degraded";
    httpStatus = 200;
  } else {
    status = "ok";
    httpStatus = 200;
  }

  return NextResponse.json(
    {
      status,
      checks,
      flags: {
        REDIS_REQUIRED: redisRequired,
        QDRANT_REQUIRED: qdrantRequired,
        NODE_ENV: process.env["NODE_ENV"] ?? "development",
      },
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus },
  );
}
