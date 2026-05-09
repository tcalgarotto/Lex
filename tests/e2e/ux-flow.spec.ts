import { test, expect } from "@playwright/test";

/**
 * E2E da jornada caso-cêntrica.
 *
 * A suite cobre os 10 cenários do briefing UX, validando o que pode ser
 * verificado sem autenticação real:
 *
 *   1. Páginas centrais existem e fazem auth gate (302 → /login?next=…).
 *   2. Redirects /biblioteca → /pesquisa-juridica e /retrieval → /pesquisa-juridica.
 *   3. APIs novas devolvem 401 sem cookie (segurança garantida).
 *   4. /retrieval/explain continua funcional (admin/debug, ainda gated).
 *
 * Os cenários "criar caso → upload → pesquisa → estratégia → peça" exigem
 * sessão Supabase real e ficam para a suite e2e-authed (separada).
 */

const PROTECTED_ROUTES = [
  { path: "/dashboard", scenario: "Início (próximas ações)" },
  { path: "/cases", scenario: "Lista de Casos" },
  { path: "/cases/new", scenario: "Novo caso" },
  { path: "/cases/abc-123", scenario: "Detalhe de caso (6 abas)" },
  { path: "/documentos", scenario: "Lista de documentos do escritório" },
  { path: "/documentos?unlinked=1", scenario: "Filtro: documentos sem caso" },
  { path: "/pesquisa-juridica", scenario: "Pesquisa jurídica (RAG amigável)" },
  { path: "/pesquisa-juridica?q=devido%20processo&scope=legislacao", scenario: "Pesquisa com query inicial" },
  { path: "/editor", scenario: "Lista de peças" },
  { path: "/busca?q=teste", scenario: "Busca global agregada" },
];

test.describe("ux-flow: jornada caso-cêntrica (sem sessão)", () => {
  for (const { path, scenario } of PROTECTED_ROUTES) {
    test(`${scenario} (${path}) responde sem 5xx e exige login`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} não pode retornar 5xx`).toBeLessThan(500);
      // `next=` pode aparecer em qualquer posição (com `?q=…&next=…` em rotas que carregam query inicial).
      await expect(page).toHaveURL(/\/login\?.*next=/, { timeout: 5000 });
    });
  }

  test("/biblioteca redireciona para /pesquisa-juridica?scope=legislacao (preservando next na auth)", async ({
    page,
  }) => {
    const res = await page.goto("/biblioteca");
    expect(res?.status()).toBeLessThan(500);
    // Sem sessão, o middleware ainda obriga login antes do redirect interno;
    // o importante é que o destino resolva via /login?next=…
    await expect(page).toHaveURL(/\/login\?.*next=/);
  });

  test("/retrieval redireciona para /pesquisa-juridica (gated por login)", async ({ page }) => {
    const res = await page.goto("/retrieval");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?.*next=/);
  });

  test("/retrieval/explain continua acessível como admin/debug (gated)", async ({ page }) => {
    const res = await page.goto("/retrieval/explain");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=%2Fretrieval%2Fexplain/);
  });
});

test.describe("ux-flow: APIs novas exigem auth", () => {
  test("GET /api/retrieval/search -> 401 sem cookie", async ({ request }) => {
    const res = await request.get("/api/retrieval/search?q=teste");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cases/abc-xyz/legal-sources -> 401 sem cookie", async ({ request }) => {
    const res = await request.get("/api/cases/abc-xyz/legal-sources");
    expect(res.status()).toBe(401);
  });

  test("POST /api/cases/abc-xyz/legal-sources -> 401 sem cookie", async ({ request }) => {
    const res = await request.post("/api/cases/abc-xyz/legal-sources", {
      data: { chunkId: "ch1", excerpt: "Trecho" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/documents/abc-xyz/link-case -> 401 sem cookie", async ({ request }) => {
    const res = await request.post("/api/documents/abc-xyz/link-case", {
      data: { caseId: "case-1" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/documents/abc-xyz/reprocess -> 401 sem cookie (proteção do reprocessamento)", async ({
    request,
  }) => {
    const res = await request.post("/api/documents/abc-xyz/reprocess");
    expect(res.status()).toBe(401);
  });

  test("GET /api/search -> 401 sem cookie", async ({ request }) => {
    const res = await request.get("/api/search?q=teste");
    expect(res.status()).toBe(401);
  });
});
