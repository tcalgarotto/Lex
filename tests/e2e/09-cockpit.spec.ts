import { test, expect } from "@playwright/test";

test.describe("cockpit operacional", () => {
  test("/cockpit redireciona para login quando não autenticado", async ({ page }) => {
    const res = await page.goto("/cockpit");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fcockpit/);
  });

  test("GET /api/cockpit/checklist -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/cockpit/checklist");
    expect(res.status()).toBe(401);
  });

  test("GET /api/alerts -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/alerts");
    expect(res.status()).toBe(401);
  });

  test("GET /api/integrations -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/integrations");
    expect(res.status()).toBe(401);
  });

  test("POST /api/integrations/sync -> 401 sem auth", async ({ request }) => {
    const res = await request.post("/api/integrations/sync");
    expect(res.status()).toBe(401);
  });

  test("GET /api/notifications -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/notifications");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cases/anyId/comments -> 401 sem auth", async ({ request }) => {
    const res = await request.get("/api/cases/abc/comments");
    expect(res.status()).toBe(401);
  });

  test("POST /api/cases/anyId/approvals -> 401 sem auth", async ({ request }) => {
    const res = await request.post("/api/cases/abc/approvals", { data: { draftId: "x" } });
    expect(res.status()).toBe(401);
  });
});
