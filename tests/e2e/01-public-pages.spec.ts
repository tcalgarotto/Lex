import { test, expect } from "@playwright/test";

/**
 * Páginas públicas (não autenticadas) devem renderizar sem JS errors.
 * Este é o "smoke" mais barato: garante que build não quebrou e middleware
 * libera o que prometeu liberar.
 */
test.describe("public pages render", () => {
  test("/ marketing carrega", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });

  test("/login mostra form com forgot link e OAuth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/e-?mail/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /continuar/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /esqueceu a senha/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
  });

  test("/register mostra form e OAuth", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel(/e-?mail/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /criar conta/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
  });

  test("/forgot-password e link voltar", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /enviar link de recupera/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: /voltar para o login/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/reset-password mostra estado de link inválido sem sessão", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/link expirou ou é inválido/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /solicitar novo link/i })).toBeVisible();
  });
});
