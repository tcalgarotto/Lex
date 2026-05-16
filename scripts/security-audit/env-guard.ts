/**
 * Aborta execução red-team se o ambiente parecer produção.
 * Nunca imprime valores de secrets — apenas nomes de variáveis e motivo.
 */

export type EnvGuardResult = { ok: true } | { ok: false; reason: string };

export function assertRedTeamSafeEnvironment(): EnvGuardResult {
  if (process.env["NODE_ENV"] === "production") {
    return { ok: false, reason: "NODE_ENV=production" };
  }
  if (process.env["VERCEL_ENV"] === "production" || process.env["VERCEL_ENV"] === "prod") {
    return { ok: false, reason: "VERCEL_ENV indica produção" };
  }

  const appUrl = (process.env["NEXT_PUBLIC_APP_URL"] ?? "").trim();
  if (appUrl) {
    const isLocal =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(appUrl) ||
      appUrl.includes(".local");
    const isHttpsRemote = appUrl.startsWith("https://") && !isLocal;
    if (isHttpsRemote && process.env["RED_TEAM_CONFIRM_STAGING"] !== "1") {
      return {
        ok: false,
        reason:
          "NEXT_PUBLIC_APP_URL remoto (HTTPS). Defina RED_TEAM_CONFIRM_STAGING=1 apenas em staging controlado.",
      };
    }
  }

  const dbUrl = (process.env["DATABASE_URL"] ?? "").trim();
  if (!dbUrl) {
    return { ok: false, reason: "DATABASE_URL ausente" };
  }

  const dbLooksLocal =
    /localhost|127\.0\.0\.1|shadow_prisma/i.test(dbUrl) ||
    process.env["RED_TEAM_CONFIRM_STAGING"] === "1";
  const dbProdHint =
    /\bprod\b/i.test(dbUrl) &&
    !dbLooksLocal &&
    process.env["RED_TEAM_CONFIRM_STAGING"] !== "1";
  if (dbProdHint) {
    return {
      ok: false,
      reason:
        'DATABASE_URL contém "prod" e não parece local. Use staging ou RED_TEAM_CONFIRM_STAGING=1.',
    };
  }

  return { ok: true };
}

export function throwIfUnsafeRedTeamEnvironment(): void {
  const r = assertRedTeamSafeEnvironment();
  if (!r.ok) {
    throw new Error(`[red-team] Ambiente bloqueado: ${r.reason}`);
  }
}

/** Bloqueia URL Supabase que pareça produção (FASE 3.2). */
export function assertSupabaseUrlNotProduction(): EnvGuardResult {
  const url = (process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "").trim().toLowerCase();
  if (!url) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL ausente" };
  }
  if (process.env["VERCEL_ENV"] === "production" || process.env["VERCEL_ENV"] === "prod") {
    return { ok: false, reason: "VERCEL_ENV indica produção" };
  }
  if (
    process.env["NODE_ENV"] === "production" &&
    process.env["RED_TEAM_CONFIRM_STAGING"] !== "1"
  ) {
    return { ok: false, reason: "NODE_ENV=production sem RED_TEAM_CONFIRM_STAGING=1" };
  }
  const looksProd =
    /prod|production|live/.test(url) && !/staging|stg|preview|dev|redteam|localhost/.test(url);
  if (looksProd) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL parece projeto de produção" };
  }
  return { ok: true };
}

/** Env mínima para storage-policy-remote (não imprime valores). */
export function assertStagingStorageTestEnv(): EnvGuardResult {
  const base = assertRedTeamSafeEnvironment();
  if (!base.ok) return base;
  const urlCheck = assertSupabaseUrlNotProduction();
  if (!urlCheck.ok) return urlCheck;
  if (process.env["RED_TEAM_CONFIRM_STAGING"] !== "1") {
    return { ok: false, reason: "RED_TEAM_CONFIRM_STAGING=1 ausente" };
  }
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_TEST_USER_A_PASSWORD",
    "SUPABASE_TEST_USER_B_PASSWORD",
  ] as const;
  const missing = required.filter((k) => !(process.env[k] ?? "").trim());
  if (missing.length > 0) {
    return { ok: false, reason: `Variáveis ausentes: ${missing.join(", ")}` };
  }
  return { ok: true };
}
