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
import {
  describeRedisUrl,
  isRedisRequired,
  pingRedis,
  type RedisUrlInfo,
} from "@/lib/redis";
import { snapshotProviderStatuses } from "@/lib/corpus/providers/registry";
import { inngestSecuritySnapshot } from "@/lib/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  ok: boolean;
  required: boolean;
  latencyMs: number;
  error?: string;
  /** Código curto de erro (ETIMEDOUT, ENOTFOUND, etc.) quando disponível. */
  errorCode?: string;
  /** Próxima ação concreta (admin-friendly). */
  hint?: string;
  /** Diagnóstico extra estruturado (sem segredo). */
  debug?: Record<string, unknown>;
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
    if (m.includes("redis_url ausente") || m.includes("missing-url") || m.includes("missingurl")) {
      return "REDIS_URL ausente neste deployment. Adicione em Vercel → Environment Variables (escopo Production) e clique Redeploy SEM cache. Mudanças de env não afetam deployments antigos.";
    }
    if (m.includes("wrong_scheme") || m.includes("https://")) {
      return "REDIS_URL usa scheme `https://` (REST API). ioredis precisa de TCP+RESP. Em Upstash → Database → Connect → escolha aba TLS e copie `rediss://default:<pwd>@<host>:6379`.";
    }
    if (m.includes("etimedout") || m.includes("ping timeout") || m.includes("connect_timeout") || m.includes("etimedout")) {
      return "Timeout conectando no Redis. Confirme que o database Upstash está ativo (não pausado por inatividade) e que a região suporta TLS na porta 6379. Se acabou de mudar a env, faça Redeploy SEM cache.";
    }
    if (m.includes("enotfound")) {
      return "Hostname Redis não resolve. Confira se copiou o host correto da Upstash (algo como `<random>-<random>-<id>.upstash.io`).";
    }
    if (m.includes("econnrefused")) {
      return "Redis recusou conexão. Confirme porta 6379 e que o database Upstash está ativo.";
    }
    if (m.includes("noauth") || m.includes("wrongpass") || m.includes("auth")) {
      return "Senha do Redis inválida. Reset em Upstash → Database → Reset Password e atualize REDIS_URL na Vercel + Redeploy.";
    }
    if (m.includes("ssl") || m.includes("tls") || m.includes("certificate")) {
      return "TLS handshake falhou. Use scheme `rediss://` (com 2 s) e confirme que o host bate com o servername do certificado do provider.";
    }
    return "Falha conectando no Redis. Após alterar env na Vercel, faça Redeploy SEM cache (env changes não afetam deployments antigos).";
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

/**
 * Devolve um RedisUrlInfo "público" — apenas dados não-secretos para o JSON
 * de health. NUNCA inclui senha ou URL completa.
 */
function publicRedisDebug(info: RedisUrlInfo): Record<string, unknown> {
  return {
    envPresent: info.envPresent,
    protocol: info.protocol,
    host: info.host,
    port: info.port,
    username: info.username,
    hasPassword: info.hasPassword,
    tls: info.tls,
    ...(info.parseError ? { parseError: info.parseError } : {}),
  };
}

/**
 * Check Redis com PING real + diagnóstico inspecionável.
 * Usa `pingRedis()` (cliente isolado, sem singleton/cache) para obter código
 * de erro exato. Sempre devolve `debug{}` com host/protocol/etc — admins
 * conseguem confirmar que o deploy atual recebeu a env certa.
 */
async function checkRedis(required: boolean): Promise<CheckResult> {
  const start = Date.now();
  const info = describeRedisUrl();
  const debug = publicRedisDebug(info);

  if (!info.envPresent) {
    if (!required) {
      return { ok: true, required, latencyMs: 0, debug };
    }
    return {
      ok: false,
      required,
      latencyMs: 0,
      error: "REDIS_URL ausente",
      hint: hintForError("redis", "redis_url ausente"),
      debug,
    };
  }

  if (info.protocol === "https") {
    return {
      ok: false,
      required,
      latencyMs: Date.now() - start,
      error: "REDIS_URL usa scheme `https://` (REST). ioredis fala TCP+RESP.",
      errorCode: "WRONG_SCHEME",
      hint: "Vá em Upstash → Database → Connect → aba TLS e copie o `rediss://default:<pwd>@<host>:6379`. NÃO use a URL REST.",
      debug,
    };
  }

  if (info.protocol !== "rediss" && info.protocol !== "redis") {
    return {
      ok: false,
      required,
      latencyMs: Date.now() - start,
      error: `Protocol desconhecido: ${info.protocol}`,
      errorCode: "BAD_SCHEME",
      hint: "Esperado `rediss://` (TLS) ou `redis://` (sem TLS). Use rediss em produção.",
      debug,
    };
  }

  const ping = await pingRedis(3_500);

  if (ping.ok) {
    return {
      ok: true,
      required,
      latencyMs: ping.latencyMs,
      debug: { ...debug, pong: ping.pong },
    };
  }

  // Falha real
  if (!required) {
    // Em dev: degraded, não-bloqueante
    return {
      ok: false,
      required,
      latencyMs: ping.latencyMs,
      error: ping.errorMessage ?? "redis ping falhou",
      ...(ping.errorCode ? { errorCode: ping.errorCode } : {}),
      hint: hintForError("redis", ping.errorMessage ?? "ping"),
      debug,
    };
  }
  return {
    ok: false,
    required,
    latencyMs: ping.latencyMs,
    error: ping.errorMessage ?? "redis ping falhou",
    ...(ping.errorCode ? { errorCode: ping.errorCode } : {}),
    hint: hintForError("redis", `${ping.errorCode ?? ""} ${ping.errorMessage ?? ""}`),
    debug,
  };
}

function isQdrantRequired(): boolean {
  const flag = (process.env["QDRANT_REQUIRED"] ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env["NODE_ENV"] === "production";
}

export async function GET() {
  const redisRequired = isRedisRequired();
  const legalRetrievalEnabled = !["false", "0", "off"].includes(
    String(process.env["ENABLE_LEGAL_RETRIEVAL"] ?? "true").toLowerCase(),
  );
  const qdrantRequired = legalRetrievalEnabled && isQdrantRequired();

  const [db, redis, qdrant, supabase] = await Promise.all([
    checkWithTimeout(
      "db",
      true,
      async () => {
        if (!process.env["DATABASE_URL"]?.trim()) {
          throw new Error("Environment variable not found: DATABASE_URL");
        }
        await prisma.$queryRaw`SELECT 1`;
      },
      3_000,
    ),
    checkRedis(redisRequired),
    checkWithTimeout(
      "qdrant",
      qdrantRequired,
      async () => {
        if (!legalRetrievalEnabled) {
          return { hint: "Qdrant / busca no corpus desativados por enquanto." };
        }
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

  // Inngest: signing/event keys obrigatórios em produção. Sem eles o
  // serve() do SDK aceita requisições não autenticadas.
  const inngestSec = inngestSecuritySnapshot();
  const inngest: CheckResult = inngestSec.isSecure
    ? {
        ok: true,
        required: inngestSec.isProduction,
        latencyMs: 0,
        debug: {
          appId: inngestSec.appId,
          hasEventKey: inngestSec.hasEventKey,
          hasSigningKey: inngestSec.hasSigningKey,
        },
      }
    : {
        ok: false,
        required: inngestSec.isProduction,
        latencyMs: 0,
        error: inngestSec.error ?? "Inngest misconfigured",
        errorCode: "MISSING_KEYS",
        hint:
          "Adicione INNGEST_EVENT_KEY e INNGEST_SIGNING_KEY em Vercel → Environment Variables (Production) e Redeploy. Ambas vêm de Inngest Cloud → Apps → <seu-app>.",
        debug: {
          appId: inngestSec.appId,
          hasEventKey: inngestSec.hasEventKey,
          hasSigningKey: inngestSec.hasSigningKey,
        },
      };

  const checks = { db, redis, qdrant, supabase, inngest };
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

  // Provedores jurídicos não bloqueiam health (são informativos): apresentam
  // visibilidade do registro e ajudam o admin a saber se DataJud aguarda chave,
  // ou se LexML/STF/STJ estão disabled. Não conta para `criticalDown`.
  let providers: ReturnType<typeof snapshotProviderStatuses> | undefined;
  try {
    providers = snapshotProviderStatuses();
  } catch {
    providers = undefined;
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
      ...(providers ? { providers } : {}),
      ...(primaryHint ? { hint: primaryHint } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus },
  );
}
