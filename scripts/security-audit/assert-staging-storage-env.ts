/**
 * Verifica presença de envs para FASE 3.2 (sem imprimir valores).
 * Exit 0 = pronto para storage-policy-remote; 1 = incompleto; 2 = produção bloqueada.
 */

const REQUIRED = [
  "RED_TEAM_CONFIRM_STAGING",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_USER_A_PASSWORD",
  "SUPABASE_TEST_USER_B_PASSWORD",
] as const;

function isProductionBlocked(): string | null {
  if (process.env["VERCEL_ENV"] === "production" || process.env["VERCEL_ENV"] === "prod") {
    return "VERCEL_ENV=production";
  }
  if (process.env["NODE_ENV"] === "production" && process.env["RED_TEAM_CONFIRM_STAGING"] !== "1") {
    return "NODE_ENV=production sem RED_TEAM_CONFIRM_STAGING=1";
  }
  const url = (process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "").toLowerCase();
  if (url && /prod|production|live/.test(url) && !/staging|stg|preview|dev|redteam/.test(url)) {
    return "NEXT_PUBLIC_SUPABASE_URL parece produção";
  }
  return null;
}

function main(): void {
  const prod = isProductionBlocked();
  if (prod) {
    console.error(`[staging-env] BLOQUEADO: ${prod}`);
    process.exit(2);
  }

  const missing = REQUIRED.filter((k) => !(process.env[k] ?? "").trim());
  if (missing.length > 0) {
    console.log(`[staging-env] INCOMPLETO: faltam ${missing.join(", ")}`);
    process.exit(1);
  }

  if (process.env["RED_TEAM_CONFIRM_STAGING"] !== "1") {
    console.log("[staging-env] INCOMPLETO: RED_TEAM_CONFIRM_STAGING=1");
    process.exit(1);
  }

  console.log("[staging-env] OK — pode rodar storage-policy-remote (staging)");
  process.exit(0);
}

main();
