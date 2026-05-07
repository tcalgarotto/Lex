import { test, expect } from "@playwright/test";

/** Middleware deve redirecionar rotas privadas para /login com `?next=`. */
test.describe("auth redirects (sem sessão)", () => {
  for (const path of [
    "/dashboard",
    "/processos",
    "/biblioteca",
    "/busca",
    "/settings/team",
    "/settings/perfil",
    "/settings/jobs",
    "/onboarding",
  ]) {
    test(`${path} redireciona para /login?next=`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(500);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, "%2F")}`),
      );
    });
  }

  test("/invite/<token> redireciona para login mantendo o token no next", async ({ page }) => {
    await page.goto("/invite/invalid-token-xyz");
    await expect(page).toHaveURL(/\/login\?next=%2Finvite%2Finvalid-token-xyz/);
  });
});
