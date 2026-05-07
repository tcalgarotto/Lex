import { test, expect } from "@playwright/test";

/**
 * Smoke E2E para a vertical de retrieval auditável.
 *
 * Sem sessão: middleware redireciona para /login mantendo o `next` correto.
 * O endpoint `/api/retrieval/explain` exige auth e devolve 401 sem cookies.
 */
test.describe("retrieval explain", () => {
  test("/retrieval/explain redireciona para login quando não autenticado", async ({ page }) => {
    const res = await page.goto("/retrieval/explain");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fretrieval%2Fexplain/);
  });

  test("GET /api/retrieval/explain -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/retrieval/explain?q=teste");
    expect(res.status()).toBe(401);
  });

  test("GET /api/retrieval/explain -> 401 prevalece sobre validação de query", async ({ request }) => {
    // Mesmo com query inválida, sem auth devolve 401 (não 400).
    const res = await request.get("/api/retrieval/explain?q=a");
    expect(res.status()).toBe(401);
  });
});
