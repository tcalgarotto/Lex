import { test, expect } from "@playwright/test";

test.describe("strategy platform", () => {
  test("/strategy redireciona para login quando não autenticado", async ({ page }) => {
    const res = await page.goto("/strategy");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fstrategy/);
  });

  test("GET /api/strategy/analyze -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/strategy/analyze?q=teste+juridico+com+mais+de+dois");
    expect(res.status()).toBe(401);
  });

  test("GET /api/lawyer-brain -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/lawyer-brain");
    expect(res.status()).toBe(401);
  });

  test("POST /api/lawyer-brain/ingest -> 401 sem auth", async ({ request }) => {
    const res = await request.post("/api/lawyer-brain/ingest", {
      data: { title: "Teste", body: "x".repeat(100) },
    });
    expect(res.status()).toBe(401);
  });
});
