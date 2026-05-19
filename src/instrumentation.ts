import * as Sentry from "@sentry/nextjs";

/**
 * Hook de inicialização do servidor Next.js — roda uma vez no boot.
 *
 * Ordem importa:
 *  1. Sentry server/edge (quando DSN configurado).
 *  2. `env-normalize` aplica fallbacks DATABASE_URL ← POSTGRES_PRISMA_URL e
 *     DIRECT_URL ← POSTGRES_URL_NON_POOLING (Vercel Supabase Integration).
 *  3. `assertCriticalEnv` valida que as obrigatórias estão preenchidas.
 */
export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("@/lib/env-normalize");
    const { registerLangfuseOtel } = await import("@/lib/observability/langfuse-otel");
    registerLangfuseOtel();
    await import("./sentry.server.config");
    const { assertCriticalEnv } = await import("@/lib/env");
    assertCriticalEnv();
  }

  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
