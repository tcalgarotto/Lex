/**
 * Normalização de envs Vercel/Supabase para Prisma + Redis.
 *
 * **Por que isso existe**
 * A Vercel Supabase Integration provisiona automaticamente:
 *   - `POSTGRES_PRISMA_URL`         (pooler transaction, porta 6543, com pgbouncer=true)
 *   - `POSTGRES_URL_NON_POOLING`    (direct/session, porta 5432, p/ migrations)
 *   - `POSTGRES_URL`, `POSTGRES_USER`, `POSTGRES_HOST`, etc.
 *
 * Mas o `prisma/schema.prisma` referencia:
 *   - `env("DATABASE_URL")`
 *   - `env("DIRECT_URL")`
 *
 * Sintoma se essas duas não estiverem presentes:
 *   `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`
 *   → Server Components quebram com "Algo saiu do esperado".
 *
 * **O que esta função faz**
 * Aplica fallback determinístico, **antes** do Prisma Client ser instanciado:
 *   - `DATABASE_URL` ← `POSTGRES_PRISMA_URL` (se ausente)
 *   - `DIRECT_URL`  ← `POSTGRES_URL_NON_POOLING` (se ausente)
 *
 * Idempotente: nunca sobrescreve valores explícitos. Se você definir
 * manualmente `DATABASE_URL` na Vercel, ele tem precedência sobre o alias.
 *
 * **Onde é chamada**
 * - `src/instrumentation.ts` no boot do server.
 * - `src/lib/prisma.ts` como side-effect do import (cinto e suspensório
 *   contra a ordem de carregamento dos Server Components).
 *
 * Não chama logger fora do dev — em produção a normalização é silenciosa
 * para não poluir Vercel logs.
 */

type NormalizeReport = {
  appliedDatabaseUrl: boolean;
  appliedDirectUrl: boolean;
  /** Aliases detectados que ficaram sem uso (já tinham DATABASE_URL/DIRECT_URL explícitos). */
  unusedAliases: string[];
};

let cached: NormalizeReport | null = null;

function isSet(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function copy(from: string, to: string): boolean {
  const value = process.env[from]?.trim();
  if (!value) return false;
  process.env[to] = value;
  return true;
}

/**
 * Aplica fallbacks. Idempotente — pode ser chamado múltiplas vezes,
 * só efetiva no primeiro.
 */
export function normalizeVercelSupabaseEnv(): NormalizeReport {
  if (cached) return cached;

  const report: NormalizeReport = {
    appliedDatabaseUrl: false,
    appliedDirectUrl: false,
    unusedAliases: [],
  };

  // DATABASE_URL ← POSTGRES_PRISMA_URL
  if (!isSet("DATABASE_URL")) {
    if (copy("POSTGRES_PRISMA_URL", "DATABASE_URL")) {
      report.appliedDatabaseUrl = true;
    }
  } else if (isSet("POSTGRES_PRISMA_URL")) {
    report.unusedAliases.push("POSTGRES_PRISMA_URL");
  }

  // DIRECT_URL ← POSTGRES_URL_NON_POOLING
  if (!isSet("DIRECT_URL")) {
    if (copy("POSTGRES_URL_NON_POOLING", "DIRECT_URL")) {
      report.appliedDirectUrl = true;
    }
  } else if (isSet("POSTGRES_URL_NON_POOLING")) {
    report.unusedAliases.push("POSTGRES_URL_NON_POOLING");
  }

  cached = report;

  if (process.env["NODE_ENV"] !== "test" && (report.appliedDatabaseUrl || report.appliedDirectUrl)) {
    const applied: string[] = [];
    if (report.appliedDatabaseUrl) applied.push("DATABASE_URL ← POSTGRES_PRISMA_URL");
    if (report.appliedDirectUrl) applied.push("DIRECT_URL ← POSTGRES_URL_NON_POOLING");
    // Log uma única vez (no boot) para deixar claro que o fallback ativou.
    console.info(`[env-normalize] Vercel/Supabase aliases aplicados: ${applied.join(", ")}`);
  }

  return report;
}

/** Para testes — limpa o cache. NÃO usar em runtime. */
export function _resetEnvNormalizeForTests(): void {
  cached = null;
}

// Side-effect: aplica imediatamente no import.
// Isso garante que mesmo módulos que sejam carregados antes do
// instrumentation.ts (ex.: client Prisma compartilhado em monorepo)
// já encontrem DATABASE_URL/DIRECT_URL preenchidos.
normalizeVercelSupabaseEnv();
