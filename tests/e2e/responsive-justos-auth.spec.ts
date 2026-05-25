import { test, expect } from "@playwright/test";
import {
  expectAppMainMinWidth,
  expectNoHorizontalOverflow,
} from "./helpers/responsive";

const authFile = "tests/e2e/.auth/user.json";

test.describe("responsivo — app autenticado", () => {
  test.use({ storageState: authFile });

  test("dashboard — menu mobile e conteúdo", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: /hoje no escritório — justos/i })).toBeVisible({
      timeout: 60_000,
    });

    if (testInfo.project.name === "auth-mobile") {
      await expect(page.getByRole("button", { name: /abrir menu/i })).toBeVisible();
      const mainBefore = await page.locator("main").first().boundingBox();
      expect(mainBefore?.x ?? 99).toBeLessThan(40);
      await page.getByRole("button", { name: /abrir menu/i }).click();
      await expect(page.getByRole("link", { name: "Casos" }).first()).toBeVisible();
    }

    if (testInfo.project.name === "auth-laptop-14") {
      await expectAppMainMinWidth(page, 720);
      const pulseGrid = page.locator(".dashboard-pulse-cards");
      if ((await pulseGrid.count()) > 0) {
        const box = await pulseGrid.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThan(600);
      }
    }
  });

  test("casos — lista sem overflow", async ({ page }) => {
    await page.goto("/cases");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  });
});
