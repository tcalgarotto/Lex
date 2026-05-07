/**
 * deploy-check — verifica que TODAS as variáveis obrigatórias para deploy
 * estão preenchidas e que os endpoints externos respondem.
 *
 * Uso:
 *   npm run deploy:check        # contra .env (dev)
 *   npm run production:check    # contra .env.production (cuidado: prod)
 *   npm run vercel:check        # usa env do shell (ideal em CI/Vercel)
 *
 * Sai com exit code != 0 se algo crítico falhar — perfeito para gate de CI.
 *
 * Detecta especialmente os **aliases da Vercel Supabase Integration**:
 *   - POSTGRES_PRISMA_URL       → equivale a DATABASE_URL
 *   - POSTGRES_URL_NON_POOLING  → equivale a DIRECT_URL
 *
 * Se a alias estiver presente mas a var canônica não, mostra a hint exata
 * de o que copiar para a Vercel — em vez de apenas dizer "ausente".
 */

// Aplica os fallbacks ANTES de checar — evita falso positivo quando o
// projeto está rodando em Vercel com a Supabase Integration ativa.
import "../src/lib/env-normalize";

type CheckStatus = "ok" | "warn" | "fail";
type Check = { name: string; status: CheckStatus; detail: string; hint?: string };

const checks: Check[] = [];

function add(name: string, status: CheckStatus, detail: string, hint?: string): void {
  checks.push({ name, status, detail, ...(hint ? { hint } : {}) });
}

function need(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

async function main() {
  // === A) App ===
  const appUrl = need("NEXT_PUBLIC_APP_URL");
  if (!appUrl) {
    add("NEXT_PUBLIC_APP_URL", "fail", "ausente", "Defina como URL canônica de produção (sem trailing slash).");
  } else {
    add("NEXT_PUBLIC_APP_URL", "ok", appUrl);
    if (appUrl.endsWith("/")) {
      add(
        "NEXT_PUBLIC_APP_URL",
        "warn",
        "termina com '/'",
        "Remova o trailing slash — links em emails/OAuth podem duplicar barras.",
      );
    }
    if (appUrl.includes("localhost") && isProduction()) {
      add("NEXT_PUBLIC_APP_URL", "fail", "localhost em produção", "Use o domínio público da Vercel ou domínio custom.");
    }
  }

  // === B) Supabase Postgres (com detecção de aliases Vercel) ===
  // DATABASE_URL — runtime
  if (need("DATABASE_URL")) {
    add("DATABASE_URL", "ok", "presente");
    const dbu = process.env["DATABASE_URL"]!;
    if (!/:6543\b/.test(dbu) && !/pgbouncer=true/.test(dbu) && isProduction()) {
      add(
        "DATABASE_URL",
        "warn",
        "não parece pooler transaction",
        "Em produção use porta 6543 com `pgbouncer=true&connection_limit=1` (Supabase pooler transaction).",
      );
    }
  } else if (need("POSTGRES_PRISMA_URL")) {
    // Após env-normalize isso só ocorre se o alias for vazio/inválido.
    add(
      "DATABASE_URL",
      "warn",
      "ausente, mas POSTGRES_PRISMA_URL existe",
      "Adicione DATABASE_URL com o mesmo valor de POSTGRES_PRISMA_URL (ou confie no fallback automático). Após editar, Redeploy sem cache.",
    );
  } else {
    add(
      "DATABASE_URL",
      "fail",
      "ausente",
      "Adicione no escopo Production. Formato: postgresql://postgres.<ref>:<PWD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
    );
  }

  // DIRECT_URL — migrations
  if (need("DIRECT_URL")) {
    add("DIRECT_URL", "ok", "presente");
  } else if (need("POSTGRES_URL_NON_POOLING")) {
    add(
      "DIRECT_URL",
      "warn",
      "ausente, mas POSTGRES_URL_NON_POOLING existe",
      "Adicione DIRECT_URL com o mesmo valor de POSTGRES_URL_NON_POOLING (ou confie no fallback automático).",
    );
  } else {
    add(
      "DIRECT_URL",
      "warn",
      "ausente — `prisma migrate deploy` pode falhar",
      "Use o pooler session (porta 5432) ou direct connection.",
    );
  }

  // Supabase URLs/keys
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (need(k)) add(k, "ok", "presente");
    else add(k, "fail", "ausente");
  }
  if (!need("SUPABASE_SERVICE_ROLE_KEY")) {
    add(
      "SUPABASE_SERVICE_ROLE_KEY",
      isProduction() ? "fail" : "warn",
      "ausente",
      "Necessário para Storage admin (uploads/downloads) e operações server-side privilegiadas.",
    );
  } else add("SUPABASE_SERVICE_ROLE_KEY", "ok", "presente");

  // === C) Redis ===
  if (!need("REDIS_URL")) {
    if (need("UPSTASH_REDIS_REST_URL")) {
      add(
        "REDIS_URL",
        isProduction() ? "fail" : "warn",
        "ausente, mas UPSTASH_REDIS_REST_URL existe (URL REST não funciona com ioredis)",
        "Pegue o endpoint TLS no Upstash: Connect → TLS → rediss://default:<pwd>@<host>.upstash.io:6379. Não use a URL REST https://.",
      );
    } else {
      add(
        "REDIS_URL",
        isProduction() ? "fail" : "warn",
        "ausente — fail-open no rate limit/cache",
        isProduction()
          ? "Adicione rediss://... do Upstash (TLS), ou para o primeiro teste defina REDIS_REQUIRED=false."
          : "Em dev, OK — Redis é opcional.",
      );
    }
  } else {
    const redisUrl = process.env["REDIS_URL"]!;
    add("REDIS_URL", "ok", "presente");
    if (redisUrl.startsWith("https://")) {
      add(
        "REDIS_URL",
        "fail",
        "começa com https:// (URL REST da Upstash)",
        "Use o endpoint TLS rediss:// — ioredis não fala REST. Trocar em Vercel → Settings → Environment Variables → Redeploy.",
      );
    } else if (!redisUrl.startsWith("rediss://") && !redisUrl.startsWith("redis://")) {
      add(
        "REDIS_URL",
        "fail",
        "scheme inesperado",
        "Use rediss://... (TLS, recomendado) ou redis://... (sem TLS, só dev).",
      );
    } else if (redisUrl.startsWith("redis://") && isProduction()) {
      add(
        "REDIS_URL",
        "warn",
        "redis:// (sem TLS) em produção",
        "Prefira rediss:// (TLS) — Upstash exige TLS por padrão.",
      );
    }
    if (redisUrl.startsWith("redis://localhost") && isProduction()) {
      add("REDIS_URL", "fail", "localhost em produção", "Use Upstash ou Redis Cloud.");
    }
  }
  add(
    "REDIS_REQUIRED",
    "ok",
    process.env["REDIS_REQUIRED"] ?? (isProduction() ? "true (default prod)" : "false (default dev)"),
  );

  // === D) Qdrant ===
  if (!need("QDRANT_URL")) {
    add(
      "QDRANT_URL",
      "fail",
      "ausente",
      "Crie cluster em https://cloud.qdrant.io e copie o endpoint.",
    );
  } else {
    add("QDRANT_URL", "ok", "presente");
    if (process.env["QDRANT_URL"]?.includes("localhost") && isProduction()) {
      add("QDRANT_URL", "fail", "localhost em produção");
    }
  }
  if (need("QDRANT_API_KEY")) add("QDRANT_API_KEY", "ok", "presente");
  else
    add(
      "QDRANT_API_KEY",
      isProduction() ? "fail" : "warn",
      "ausente",
      "Gere em Qdrant Cloud → API Keys.",
    );

  // === E) Inngest ===
  if (isProduction()) {
    if (!need("INNGEST_EVENT_KEY"))
      add(
        "INNGEST_EVENT_KEY",
        "fail",
        "ausente em prod",
        "App → Settings → Event Keys (Inngest Cloud).",
      );
    else add("INNGEST_EVENT_KEY", "ok", "presente");
    if (!need("INNGEST_SIGNING_KEY"))
      add(
        "INNGEST_SIGNING_KEY",
        "fail",
        "ausente em prod",
        "App → Settings → Signing Key (Inngest Cloud).",
      );
    else add("INNGEST_SIGNING_KEY", "ok", "presente");
    if (!need("INNGEST_APP_ID"))
      add("INNGEST_APP_ID", "warn", "ausente — fallback `lex-production`");
    else add("INNGEST_APP_ID", "ok", process.env["INNGEST_APP_ID"]!);
  } else {
    add(
      "INNGEST_EVENT_KEY",
      need("INNGEST_EVENT_KEY") ? "ok" : "warn",
      need("INNGEST_EVENT_KEY") ?? "ausente em dev (ok)",
    );
  }

  // === F) IA ===
  const provider = need("AI_CHAT_PROVIDER") ?? "deepseek";
  add("AI_CHAT_PROVIDER", "ok", provider);
  const providerKey: Record<string, string> = {
    deepseek: "DEEPSEEK_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  const k = providerKey[provider] ?? "DEEPSEEK_API_KEY";
  if (need(k)) add(k, "ok", "presente");
  else add(k, "fail", `ausente (necessário para AI_CHAT_PROVIDER=${provider})`);
  if (!need("DEEPINFRA_API_KEY"))
    add(
      "DEEPINFRA_API_KEY",
      isProduction() ? "fail" : "warn",
      "ausente — embeddings/reranker indisponíveis",
    );
  else add("DEEPINFRA_API_KEY", "ok", "presente");

  // === H) Email ===
  if (!need("RESEND_API_KEY") && !need("SMTP_URL")) {
    add(
      "EMAIL_PROVIDER",
      isProduction() ? "fail" : "warn",
      "nenhum provedor configurado (RESEND_API_KEY / SMTP_URL)",
    );
  } else add("EMAIL_PROVIDER", "ok", need("RESEND_API_KEY") ? "RESEND" : "SMTP");

  // === I) Observabilidade ===
  if (!need("SENTRY_DSN")) add("SENTRY_DSN", "warn", "ausente — recomendado em prod");
  else add("SENTRY_DSN", "ok", "presente");

  // === Health endpoints (online) ===
  if (appUrl && !appUrl.includes("localhost")) {
    try {
      const start = Date.now();
      const res = await fetch(`${appUrl}/api/ready`, { cache: "no-store" });
      add("/api/ready", res.ok ? "ok" : "fail", `${res.status} em ${Date.now() - start}ms`);
    } catch (e) {
      add("/api/ready", "warn", `falha ao conectar: ${(e as Error).message}`);
    }
    try {
      const start = Date.now();
      const res = await fetch(`${appUrl}/api/health`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        hint?: string;
      };
      add(
        "/api/health",
        res.ok ? "ok" : "fail",
        `${res.status} ${body.status ?? ""} em ${Date.now() - start}ms`,
        body.hint,
      );
    } catch (e) {
      add("/api/health", "warn", `falha ao conectar: ${(e as Error).message}`);
    }
  }

  // === Render report ===
  const ICON: Record<CheckStatus, string> = { ok: "OK ", warn: "WRN", fail: "ERR" };
  for (const c of checks) {
    console.log(`[${ICON[c.status]}] ${c.name.padEnd(34)} ${c.detail}`);
    if (c.hint) console.log(`    ↳ ${c.hint}`);
  }
  const errs = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  console.log(
    `\n${checks.length} checks · ${checks.length - errs.length - warns.length} ok · ${warns.length} warn · ${errs.length} fail`,
  );
  if (errs.length > 0) {
    console.log("\nDeploy NÃO recomendado: corrija os erros listados acima.");
    process.exit(1);
  }
  if (warns.length > 0 && isProduction()) {
    console.log("\nAtenção: warnings em produção podem impactar features. Reveja antes de promover.");
  }
}

main().catch((e) => {
  console.error("deploy-check falhou:", e);
  process.exit(2);
});
