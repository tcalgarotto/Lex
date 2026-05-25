import { test, expect } from "@playwright/test";
import {
  expectMarketingWellMinWidth,
  expectNoHorizontalOverflow,
  VIEWPORTS,
  type ViewportKey,
} from "./helpers/responsive";

for (const key of Object.keys(VIEWPORTS) as ViewportKey[]) {
  const vp = VIEWPORTS[key];

  test.describe(`responsivo — ${vp.label} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("landing JustOS sem overflow e H1 visível", async ({ page }) => {
      await page.goto("/");
      await expectNoHorizontalOverflow(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /casos, fundamentos e minutas/i,
        }),
      ).toBeVisible();
      if (key === "mobile") {
        await expectMarketingWellMinWidth(page, 320);
        await page.locator("#landing-mobile-menu summary").click();
        await expect(page.locator("#landing-mobile-nav")).toBeVisible();
        const mobileNav = page.getByRole("navigation", { name: /principal mobile/i });
        for (const label of ["Pilares", "Recursos", "Preços"] as const) {
          await expect(mobileNav.getByRole("link", { name: label, exact: true })).toBeVisible();
        }
        await expect(mobileNav.getByRole("link", { name: "Solicitar acesso" })).toBeVisible();
      }
    });

    test("login — formulário utilizável", async ({ page }) => {
      await page.goto("/login");
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole("heading", { name: /entrar no justos/i })).toBeVisible();
      const box = await page.locator("form").first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(280);
    });
  });
}
