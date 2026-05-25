import { expect, type Page } from "@playwright/test";

export const VIEWPORTS = {
  mobile: { width: 390, height: 844, label: "mobile" },
  laptop14: { width: 1366, height: 768, label: "laptop-14" },
  desktop: { width: 1440, height: 900, label: "desktop" },
} as const;

export type ViewportKey = keyof typeof VIEWPORTS;

/** Sem overflow horizontal visível (tolerância 1px por subpixel). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "scrollWidth deve caber na viewport").toBeLessThanOrEqual(1);
}

/** Poço de conteúdo marketing usa largura útil mínima em mobile. */
export async function expectMarketingWellMinWidth(page: Page, minPx: number) {
  const width = await page.locator(".lex-marketing-well").first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width;
  });
  expect(width).toBeGreaterThanOrEqual(minPx);
}

/** App: coluna principal não deve ficar estreita demais (< 280px) em laptop. */
export async function expectAppMainMinWidth(page: Page, minPx: number) {
  const width = await page.locator("main").first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width;
  });
  expect(width).toBeGreaterThanOrEqual(minPx);
}
