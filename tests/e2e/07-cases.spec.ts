import { test, expect } from "@playwright/test";

/**
 * Smoke E2E para a vertical de Legal Workflow Automation.
 *
 * Sem sessão:
 *   - /cases redireciona para login
 *   - /cases/new redireciona para login
 *   - /cases/[id] redireciona para login
 *   - GET/POST /api/cases devolve 401
 *   - POST /api/cases/fundamental-intake devolve 401
 *   - POST /api/cases/[id]/draft devolve 401
 *   - POST /api/cases/[id]/review devolve 401
 */
test.describe("legal workflow automation", () => {
  test("/cases redireciona para login quando não autenticado", async ({ page }) => {
    const res = await page.goto("/cases");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fcases/);
  });

  test("/cases/new redireciona para login quando não autenticado", async ({ page }) => {
    const res = await page.goto("/cases/new");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fcases%2Fnew/);
  });

  test("/cases/[id] redireciona para login quando não autenticado", async ({ page }) => {
    const res = await page.goto("/cases/abc-123");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fcases%2Fabc-123/);
  });

  test("POST /api/cases/fundamental-intake -> 401 sem auth", async ({ request }) => {
    const res = await request.post("/api/cases/fundamental-intake", {
      data: { action: "draft", form: {} },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/cases -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/cases");
    expect(res.status()).toBe(401);
  });

  test("POST /api/cases -> 401 sem auth (intake bloqueado)", async ({ request }) => {
    const res = await request.post("/api/cases", { data: { rawInput: "Texto suficientemente longo para passar de 20 chars." } });
    expect(res.status()).toBe(401);
  });

  test("POST /api/cases/[id]/draft -> 401 sem auth", async ({ request }) => {
    const res = await request.post("/api/cases/abc-123/draft");
    expect(res.status()).toBe(401);
  });

  test("POST /api/cases/[id]/review -> 401 sem auth", async ({ request }) => {
    const res = await request.post("/api/cases/abc-123/review");
    expect(res.status()).toBe(401);
  });
});
