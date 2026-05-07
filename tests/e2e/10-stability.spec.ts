import { test, expect } from "@playwright/test";

test.describe("stability + deploy readiness", () => {
  test("/api/ready responde JSON estável", async ({ request }) => {
    const res = await request.get("/api/ready");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(typeof body.timestamp).toBe("string");
  });

  test("/api/health retorna estrutura {status, checks, flags}", async ({ request }) => {
    const res = await request.get("/api/health");
    // 200 (ok/degraded) ou 503 (down) — ambos são respostas estruturadas.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(body.checks).toBeDefined();
    expect(body.checks.db).toBeDefined();
    expect(body.checks.redis).toBeDefined();
    expect(body.checks.qdrant).toBeDefined();
    expect(body.checks.supabase).toBeDefined();
    expect(typeof body.flags.REDIS_REQUIRED).toBe("boolean");
  });

  test("/test-guide redireciona para login sem auth", async ({ page }) => {
    const res = await page.goto("/test-guide");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Ftest-guide/);
  });
});
