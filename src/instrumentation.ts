/**
 * Hook de inicialização do servidor Next.js — roda uma vez no boot.
 * Validamos as variáveis críticas para falhar cedo com mensagem amigável
 * em vez de explodir em runtime no primeiro request.
 */
export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { assertCriticalEnv } = await import("@/lib/env");
    assertCriticalEnv();
  }
}
