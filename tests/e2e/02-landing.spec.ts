import { test, expect } from "@playwright/test";

test.describe("landing pública", () => {
  test("home: H1, CTA, footer e links legais", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /casos, fundamentos e minutas/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /solicitar acesso/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /termos de uso/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /privacidade/i }).first()).toBeVisible();
  });

  test("link Recursos abre /produto", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Recursos", exact: true }).first().click();
    await expect(page).toHaveURL(/\/produto/);
    await expect(page.getByRole("heading", { level: 1, name: /recursos em três jornadas/i })).toBeVisible();
    const jornadas = page.locator("#jornadas");
    await jornadas.scrollIntoViewIfNeeded();
    await expect(jornadas.getByText(/Jornada 1/)).toContainText("Captação");
  });

  test("menu mobile abre", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("#landing-mobile-menu summary").click();
    await expect(page.locator("#landing-mobile-nav")).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar acesso" }).last()).toBeVisible();
  });

  test("formulário exige campos obrigatórios", async ({ page }) => {
    await page.goto("/#beta");
    const email = page.locator("#beta-email");
    await page.getByRole("button", { name: /^solicitar acesso$/i }).last().click();
    await expect(email).toHaveJSProperty("validity.valueMissing", true);
  });

  test("FAQ e consentimento acessíveis", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /perguntas que sócios/i })).toBeVisible();
    await page.goto("/#beta");
    const consent = page.locator("#beta-consent");
    await expect(consent).toBeVisible();
    await expect(consent).not.toHaveAttribute("readonly", "");
    await expect(consent).toBeEnabled();
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
