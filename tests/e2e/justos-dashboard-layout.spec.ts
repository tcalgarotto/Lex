import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers/responsive";

const authFile = "tests/e2e/.auth/user.json";

test.describe("JustOS dashboard layout", () => {
  test.use({ viewport: { width: 1440, height: 900 }, storageState: authFile });

  test("sidebar fixa sem botão de recolher", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /recolher menu lateral/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /expandir menu lateral/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Casos", exact: true })).toBeVisible();
  });

  test("cockpit full-width com quadro e métricas", async ({ page }) => {
    await page.goto("/dashboard");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("justos-dashboard")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bom dia|Boa tarde|Boa noite/);
    await expect(page.getByRole("heading", { name: "O que fazer agora" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quadro de casos" })).toBeVisible();
    await expect(page.getByTestId("dashboard-kanban-board")).toBeVisible({ timeout: 15_000 });
    const board = page.locator(".justos-dashboard__board-scroll");
    const box = await board.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(600);
  });

  test("mover estágio via select (fallback sem drag)", async ({ page }) => {
    await page.goto("/dashboard");
    const board = page.getByTestId("dashboard-kanban-board");
    await expect(board).toBeVisible({ timeout: 15_000 });
    const select = page.locator(".justos-dashboard__case-card").first().locator("select");
    if ((await select.count()) === 0) {
      test.skip(true, "Sem cards no quadro — ambiente sem casos");
    }
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  });
});

test.describe("JustOS dashboard — laptop 1366", () => {
  test.use({ viewport: { width: 1366, height: 768 }, storageState: authFile });

  test("layout responsivo sem overflow", async ({ page }) => {
    await page.goto("/dashboard");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("justos-dashboard")).toBeVisible();
  });
});
