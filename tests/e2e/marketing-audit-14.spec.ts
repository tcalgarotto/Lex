import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers/responsive";

/** Auditoria visual/copy — laptop 14" (1366×768), alinhado ao pedido Impeccable. */
test.use({ viewport: { width: 1366, height: 768 } });

test.describe("auditoria marketing — 14\"", () => {
  test("home: seções, intenção, header único, sem overflow", async ({ page }) => {
    await page.goto("/");
    await expectNoHorizontalOverflow(page);

    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();

    const sectionIds = [
      "inicio",
      "pilares",
      "beta",
      "intencao",
      "recursos",
      "como-funciona",
      "seguranca",
      "compromissos",
      "faq",
    ];
    for (const id of sectionIds) {
      const el = page.locator(`#${id}`);
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
    }

    await expect(page.getByText(/por que o justos/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /conexão entre atendimento, estratégia e peça/i }),
    ).toBeVisible();
    await expect(page.getByText(/contexto espalhado/i)).toBeVisible();
    await expect(page.getByText(/um caso, um painel/i)).toBeVisible();

    await expect(page.getByText(/IA nativa/i)).toHaveCount(0);
    await expect(page.getByText(/onboarding/i)).toHaveCount(0);
    await expect(page.getByText(/beta privado/i)).toHaveCount(0);
  });

  test("nav única: Pilares de /produto leva à home", async ({ page }) => {
    await page.goto("/produto");
    await expect(page.getByRole("navigation", { name: /nesta página/i })).toHaveCount(0);
    const pilares = page.getByRole("navigation", { name: "Principal" }).getByRole("link", {
      name: "Pilares",
      exact: true,
    });
    await expect(pilares).toBeVisible();
    await pilares.click();
    await expect(page).toHaveURL(/\/#pilares/);
    await expect(page.locator("#pilares")).toBeVisible();
  });

  test("/produto: jornadas, beta e footer", async ({ page }) => {
    await page.goto("/produto");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { level: 1, name: /recursos em três jornadas/i })).toBeVisible();
    await page.locator("#jornadas").scrollIntoViewIfNeeded();
    await expect(page.getByText(/Jornada 1/)).toBeVisible();
    await page.locator("#beta").scrollIntoViewIfNeeded();
    await expect(page.locator("#beta-email")).toBeVisible();
    await page.getByRole("contentinfo").getByRole("link", { name: "Segurança" }).click();
    await expect(page).toHaveURL(/\/#seguranca/);
  });
});
