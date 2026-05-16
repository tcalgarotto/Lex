import { test, expect } from "@playwright/test";

test.describe("landing pública", () => {
  test("home: H1, CTA, footer e links legais", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /organize seus casos, encontre fundamentos/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /solicitar acesso/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /termos de uso/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /privacidade/i }).first()).toBeVisible();
  });

  test("âncora #recursos navega", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Recursos", exact: true }).first().click();
    await expect(page).toHaveURL(/#recursos/);
    await expect(page.locator("#recursos")).toBeInViewport();
  });

  test("menu mobile abre", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /abrir menu/i }).click();
    await expect(page.getByRole("navigation", { name: /mobile/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar acesso" }).last()).toBeVisible();
  });

  test("formulário exige campos obrigatórios", async ({ page }) => {
    await page.goto("/#beta");
    const email = page.locator("#beta-email");
    await page.getByRole("button", { name: /^solicitar acesso$/i }).last().click();
    await expect(email).toHaveJSProperty("validity.valueMissing", true);
  });

  test("/termos e /privacidade carregam", async ({ page }) => {
    await page.goto("/termos");
    await expect(page.getByRole("heading", { level: 1, name: /termos de uso/i })).toBeVisible();
    await page.goto("/privacidade");
    await expect(
      page.getByRole("heading", { level: 1, name: /política de privacidade/i }),
    ).toBeVisible();
  });
});
