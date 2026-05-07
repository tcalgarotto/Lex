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
 * Cada check carrega `error` curto + opcional `hint` com a próxima ação
 * concreta (ex.: "Add DATABASE_URL in Vercel and Redeploy"). Isso é o que
 * permite operar produção sem precisar abrir Vercel logs.
 *
 * O endpoint nunca lança — sempre devolve JSON estável (200 ou 503).
 */

import { NextResponse } from "next/server";
import "@/lib/env-normalize"; // aplica POSTGRES_PRISMA_URL → DATABASE_URL antes de checar
import { prisma } from "@/lib/prisma";
import { getRedis, isRedisAvailable, isRedisRequired } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  ok: boolean;
  required: boolean;
  latencyMs: number;
  error?: string;
  /** Próxima ação concreta (admin-friendly). */
  hint?: string;
};

async function checkWithTimeout(
  label: string,
  required: boolean,
  fn: () => Promise<{ hint?: string } | void | undefined>,
  timeoutMs: number,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const out = await Promise.race<{ hint?: string } | void | undefined>([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return {
      ok: true,
      required,
      latencyMs: Date.now() - start,
      ...(out && "hint" in out && out.hint ? { hint: out.hint } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      required,
      latencyMs: Date.now() - start,
      error: message,
      hint: hintForError(label, message),
    };
  }
}

/**
 * Mapeia mensagens crípticas (Prisma, ioredis, fetch) para próxima ação
 * concreta. Aparecem no JSON do health e na UI de readiness.
 */
function hintForError(component: string, message: string): string {
  const m = message.toLowerCase();

  if (component === "db") {
    if (m.includes("environment variable not found: database_url") || m.includes("database_url")) {
      const hasPostgresPrisma = Boolean(process.env["POSTGRES_PRISMA_URL"]?.trim());
      if (hasPostgresPrisma) {
        return "POSTGRES_PRISMA_URL existe (Vercel Supabase Integration), mas DATABASE_URL não. Copie o valor de POSTGRES_PRISMA_URL para DATABASE_URL em Vercel → Environment Variables (Production) e Redeploy.";
      }
      return "DATABASE_URL ausente neste deployment. Adicione em Vercel → Settings → Environment Variables (escopo Production) e clique em Redeploy. Use o pooler transaction do Supabase (porta 6543, pgbouncer=true).";
    }
    if (m.includes("can't reach database server") || m.includes("connect econnrefused")) {
      return "Postgres inacessível. Confirme que DATABASE_URL aponta para Supabase pooler (porta 6543, pgbouncer=true&connection_limit=1) e que IP da Vercel não está bloqueado.";
    }
    if (m.includes("authentication failed") || m.includes("password authentication")) {
      return "Senha do Postgres inválida. Renove em Supabase → Project Settings → Database e atualize DATABASE_URL/DIRECT_URL na Vercel.";
    }
    if (m.includes("ssl") || m.includes("tls")) {
      return "Erro TLS no Postgres. Garanta que a connection string do Supabase pooler está completa (sem alterações de SSL).";
    }
    return "Falha conectando no Postgres. Veja Vercel Function logs.";
  }

  if (component === "redis") {
    if (m.includes("redis_url ausente") || m.includes("missing-url")) {
      return "REDIS_URL ausente. Adicione em Vercel → Environment Variables (escopo Production) e Redeploy. Use formato TLS: rediss://default:<pwd>@<host>.upstash.io:6379";
    }
    if (m.includes("ping falhou") || m.includes("ping timeout") || m.includes("econnrefused")) {
      return "Redis não responde ao PING. Confirme que REDIS_URL é rediss:// (TLS) e não a URL REST https://. ioredis não funciona com REST.";
    }
    if (m.includes("noauth") || m.includes("wrongpass") || m.includes("auth")) {
      return "Senha do Redis inválida. Reset em Upstash → Database e atualize REDIS_URL.";
    }
    return "Para o primeiro teste sem Redis, defina REDIS_REQUIRED=false em Production.";
  }

  if (component === "qdrant") {
    if (m.includes("qdrant_url ausente")) {
      return "QDRANT_URL ausente. Configure Qdrant Cloud e adicione QDRANT_URL/QDRANT_API_KEY na Vercel.";
    }
    if (m.includes("/readyz") && /4\d\d/.test(m)) {
      return "Qdrant respondeu 4xx. Confirme QDRANT_API_KEY na Vercel == valor da console.";
    }
    return "Para o primeiro teste sem Qdrant, defina QDRANT_REQUIRED=false em Production.";
  }

  if (component === "supabase") {
    if (m.includes("ausentes") || m.includes("missing")) {
      return "NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes. Adicione em Vercel (escopo Production) e Redeploy.";
    }
    if (m.includes("/health") && /5\d\d/.test(m)) {
      return "Supabase Auth instável. Cheque https://status.supabase.com.";
    }
    return "Falha conectando no Supabase Auth. Cheque NEXT_PUBLIC_SUPABASE_URL.";
  }

  return "";
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
      async () => {
        if (!process.env["DATABASE_URL"]?.trim()) {
          throw new Error("Environment variable not found: DATABASE_URL");
        }
        await prisma.$queryRawUnsafe("SELECT 1");
      },
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

  // Resumo top-level com a primeira ação prioritária — torna fácil grepar
  // logs/uptime monitors sem parsear toda a estrutura.
  const primaryHint =
    Object.values(checks).find((c) => c.required && !c.ok)?.hint ??
    Object.values(checks).find((c) => !c.ok)?.hint ??
    "";

  return NextResponse.json(
    {
      status,
      checks,
      flags: {
        REDIS_REQUIRED: redisRequired,
        QDRANT_REQUIRED: qdrantRequired,
        NODE_ENV: process.env["NODE_ENV"] ?? "development",
      },
      ...(primaryHint ? { hint: primaryHint } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus },
  );
}
