import { test, expect } from "@playwright/test";

/**
 * Matriz Kommo-like — cenários simulados via API quando autenticado.
 * QR real: BLOCKED_BY_HUMAN_INPUT (ver scripts/justos-wa-e2e-real-checklist.ts)
 */

test.describe("JustOS CRM Kommo parity (smoke)", () => {
  test.skip(true, "Requer sessão autenticada + workspace Pro — rodar com storageState em CI");

  test("CRM routes respond", async ({ page }) => {
    await page.goto("/crm");
    await expect(page.getByRole("heading", { name: /CRM/i })).toBeVisible();
    await page.goto("/crm/inbox");
    await expect(page.getByText(/Conversas|inbox/i)).toBeVisible();
    await page.goto("/crm/pipeline");
    await expect(page.getByText(/Pipeline/i)).toBeVisible();
    await page.goto("/crm/automations");
    await expect(page.getByText(/Automações/i)).toBeVisible();
  });
});
