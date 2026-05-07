/**
 * Hook de inicialização do servidor Next.js — roda uma vez no boot.
 *
 * Ordem importa:
 *  1. `env-normalize` aplica fallbacks DATABASE_URL ← POSTGRES_PRISMA_URL e
 *     DIRECT_URL ← POSTGRES_URL_NON_POOLING (Vercel Supabase Integration).
 *  2. `assertCriticalEnv` valida que as obrigatórias estão preenchidas e
 *     emite warnings amigáveis para opcionais.
 *
 * Falhar cedo é melhor que explodir em runtime no primeiro request.
 */
export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("@/lib/env-normalize");
    const { assertCriticalEnv } = await import("@/lib/env");
    assertCriticalEnv();
  }
}
