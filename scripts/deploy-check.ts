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
 */

type CheckStatus = "ok" | "warn" | "fail";
type Check = { name: string; status: CheckStatus; detail: string };

const checks: Check[] = [];

function add(name: string, status: CheckStatus, detail: string): void {
  checks.push({ name, status, detail });
}

function need(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

async function main() {
  // === A) App ===
  if (need("NEXT_PUBLIC_APP_URL")) add("NEXT_PUBLIC_APP_URL", "ok", process.env["NEXT_PUBLIC_APP_URL"]!);
  else add("NEXT_PUBLIC_APP_URL", "fail", "ausente");
  if (process.env["NEXT_PUBLIC_APP_URL"]?.includes("localhost") && isProduction()) {
    add("NEXT_PUBLIC_APP_URL", "fail", "localhost em produção");
  }

  // === B) Supabase ===
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "DATABASE_URL"]) {
    if (need(k)) add(k, "ok", "presente");
    else add(k, "fail", "ausente");
  }
  if (!need("DIRECT_URL")) add("DIRECT_URL", "warn", "ausente — `prisma migrate deploy` pode falhar");
  if (!need("SUPABASE_SERVICE_ROLE_KEY")) {
    add("SUPABASE_SERVICE_ROLE_KEY", isProduction() ? "fail" : "warn", "ausente");
  } else add("SUPABASE_SERVICE_ROLE_KEY", "ok", "presente");

  // === C) Redis ===
  if (!need("REDIS_URL")) {
    add("REDIS_URL", isProduction() ? "fail" : "warn", "ausente — fail-open no rate limit/cache");
  } else {
    add("REDIS_URL", "ok", "presente");
    if (need("REDIS_URL")?.startsWith("redis://localhost") && isProduction()) {
      add("REDIS_URL", "fail", "localhost em produção");
    }
  }
  add(
    "REDIS_REQUIRED",
    "ok",
    process.env["REDIS_REQUIRED"] ?? (isProduction() ? "true (default prod)" : "false (default dev)"),
  );

  // === D) Qdrant ===
  if (!need("QDRANT_URL")) add("QDRANT_URL", "fail", "ausente");
  else {
    add("QDRANT_URL", "ok", "presente");
    if (process.env["QDRANT_URL"]?.includes("localhost") && isProduction()) {
      add("QDRANT_URL", "fail", "localhost em produção");
    }
  }
  if (need("QDRANT_API_KEY")) add("QDRANT_API_KEY", "ok", "presente");
  else add("QDRANT_API_KEY", isProduction() ? "fail" : "warn", "ausente");

  // === E) Inngest ===
  if (isProduction()) {
    if (!need("INNGEST_EVENT_KEY")) add("INNGEST_EVENT_KEY", "fail", "ausente em prod");
    else add("INNGEST_EVENT_KEY", "ok", "presente");
    if (!need("INNGEST_SIGNING_KEY")) add("INNGEST_SIGNING_KEY", "fail", "ausente em prod");
    else add("INNGEST_SIGNING_KEY", "ok", "presente");
  } else {
    add("INNGEST_EVENT_KEY", need("INNGEST_EVENT_KEY") ? "ok" : "warn", need("INNGEST_EVENT_KEY") ?? "ausente em dev (ok)");
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
  if (!need("DEEPINFRA_API_KEY")) add("DEEPINFRA_API_KEY", isProduction() ? "fail" : "warn", "ausente — embeddings/reranker indisponíveis");
  else add("DEEPINFRA_API_KEY", "ok", "presente");

  // === H) Email ===
  if (!need("RESEND_API_KEY") && !need("SMTP_URL")) {
    add("EMAIL_PROVIDER", isProduction() ? "fail" : "warn", "nenhum provedor configurado (RESEND_API_KEY / SMTP_URL)");
  } else add("EMAIL_PROVIDER", "ok", need("RESEND_API_KEY") ? "RESEND" : "SMTP");

  // === I) Observabilidade ===
  if (!need("SENTRY_DSN")) add("SENTRY_DSN", "warn", "ausente — recomendado em prod");
  else add("SENTRY_DSN", "ok", "presente");

  // === Health endpoints (online) ===
  const appUrl = need("NEXT_PUBLIC_APP_URL");
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
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      add("/api/health", res.ok ? "ok" : "fail", `${res.status} ${body.status ?? ""} em ${Date.now() - start}ms`);
    } catch (e) {
      add("/api/health", "warn", `falha ao conectar: ${(e as Error).message}`);
    }
  }

  // === Render report ===
  const ICON: Record<CheckStatus, string> = { ok: "OK ", warn: "WRN", fail: "ERR" };
  for (const c of checks) {
    console.log(`[${ICON[c.status]}] ${c.name.padEnd(34)} ${c.detail}`);
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
