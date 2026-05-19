/**
 * FASE 5.4 — QA jurídico em staging/local (browser + API autenticado).
 * Requer projeto `chromium-auth` (auth.setup.ts) — ver playwright.config.ts.
 */
import { test, expect } from "@playwright/test";
import { MINIMAL_VALID_PDF } from "./helpers/minimal-pdf";

const RT_CASE_A = "rt_case_a";
const RT_CASE_B = "rt_case_b";
const RT_WORKSPACE_B = "rt_workspace_b";
const RT_DOC_B = "rt_document_b";
const SECRET_B = "segredo ultra confidencial Bravo";
const BRAVO_CASE_TITLE = "[REDTEAM] Caso Bravo";

const hasDeepSeek = Boolean(process.env["DEEPSEEK_API_KEY"]?.trim());

test.describe("FASE 5.4 — Security QA staging", () => {
  test.describe.configure({ mode: "serial" });

  let forbiddenInNetwork = false;
  let uploadedDocId: string | null = null;

  test.beforeEach(async ({ page }) => {
    forbiddenInNetwork = false;
    page.on("console", (msg) => {
      const t = msg.text();
      if (
        /Bearer\s+eyJ|SUPABASE_SERVICE_ROLE|DEEPSEEK_API_KEY|sk-[a-z0-9]{16,}/i.test(t) ||
        t.includes(SECRET_B)
      ) {
        forbiddenInNetwork = true;
      }
    });
    page.on("response", async (res) => {
      try {
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.includes("json") && !ct.includes("text")) return;
        const body = await res.text();
        if (body.length > 500_000) return;
        if (
          /Bearer\s+eyJ|service_role|SUPABASE_SERVICE_ROLE/i.test(body) ||
          body.includes(SECRET_B)
        ) {
          forbiddenInNetwork = true;
        }
      } catch {
        /* ignore */
      }
    });
  });

  test("UI.1 casos workspace A sem Bravo", async ({ page }) => {
    await page.goto("/cases");
    await expect(page).not.toHaveURL(/\/login/);
    const content = await page.content();
    expect(content.includes(SECRET_B)).toBe(false);
    expect(content.includes(BRAVO_CASE_TITLE)).toBe(false);
    expect(content.includes("Cliente Bravo Falso")).toBe(false);
  });

  test("WS.1 troca indevida para workspace B → 403", async ({ request }) => {
    const res = await request.post("/api/workspaces/active", {
      data: { workspaceId: RT_WORKSPACE_B },
    });
    expect(res.status()).toBe(403);
    const json = (await res.json()) as { error?: string };
    expect(json.error ?? "").toMatch(/não pertence|workspace/i);
  });

  test("WS.2 lista casos não expõe caso Bravo", async ({ request }) => {
    const res = await request.get("/api/cases?limit=50");
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { cases?: Array<{ id?: string; title?: string }> };
    const cases = json.cases ?? [];
    const ids = cases.map((c) => c.id);
    const titles = cases.map((c) => c.title ?? "").join("\n");
    expect(ids).not.toContain(RT_CASE_B);
    expect(titles.includes(BRAVO_CASE_TITLE)).toBe(false);
    expect(titles.includes(SECRET_B)).toBe(false);
  });

  test("API.3 documento B bloqueado", async ({ request }) => {
    const res = await request.get(`/api/documents/${RT_DOC_B}/file`);
    expect([401, 403, 404]).toContain(res.status());
    const text = await res.text();
    expect(text.includes(SECRET_B)).toBe(false);
  });

  test("API.4 upload PDF falso → 415", async ({ request }) => {
    const fakePdf = Buffer.from("hello");
    const res = await request.post("/api/documents/upload", {
      multipart: {
        caseId: RT_CASE_A,
        file: {
          name: "fake.pdf",
          mimeType: "application/pdf",
          buffer: fakePdf,
        },
      },
    });
    expect(res.status()).toBe(415);
  });

  test("API.5 upload PDF válido → 200 e metadados acessíveis", async ({ request }) => {
    const name = `redteam-e2e-${Date.now()}.pdf`;
    const res = await request.post("/api/documents/upload", {
      multipart: {
        caseId: RT_CASE_A,
        file: {
          name,
          mimeType: "application/pdf",
          buffer: MINIMAL_VALID_PDF,
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { documentId?: string; caseId?: string; error?: string };
    expect(json.documentId).toBeTruthy();
    expect(json.caseId).toBe(RT_CASE_A);
    uploadedDocId = json.documentId!;

    const meta = await request.get(`/api/documents/${uploadedDocId}`);
    expect(meta.status()).toBe(200);
    const metaJson = (await meta.json()) as { document?: { id?: string } };
    expect(metaJson.document?.id).toBe(uploadedDocId);
    const metaText = JSON.stringify(metaJson);
    expect(metaText.includes(SECRET_B)).toBe(false);
  });

  test("API.6 pesquisa sem Bravo", async ({ request }) => {
    const res = await request.get(
      `/api/retrieval/search?q=${encodeURIComponent("confidencial")}&layers=caso&caseId=${RT_CASE_A}`,
    );
    expect(res.status()).toBeLessThan(500);
    const json = await res.json();
    const s = JSON.stringify(json);
    expect(s.includes(SECRET_B)).toBe(false);
  });

  test("API.7 estratégia caso B → 404", async ({ request }) => {
    const resB = await request.post(`/api/cases/${RT_CASE_B}/strategy/generate`, {
      data: {},
    });
    expect(resB.status()).toBe(404);
  });

  test("PEÇA.1 minuta caso A — sem Bravo (API)", async ({ request }) => {
    const res = await request.post(`/api/cases/${RT_CASE_A}/drafts`, {
      data: {},
    });
    expect(res.status()).not.toBe(401);
    const text = await res.text();
    expect(text.includes(SECRET_B)).toBe(false);
    expect(text.includes("Cliente Bravo Falso")).toBe(false);

    if (hasDeepSeek) {
      expect([200, 201, 409, 429, 502, 503]).toContain(res.status());
      if (res.status() === 201) {
        const json = JSON.parse(text) as { draft?: { content?: string } };
        const content = json.draft?.content ?? "";
        expect(content.includes(SECRET_B)).toBe(false);
      }
    } else {
      expect([409, 429, 500, 502, 503]).toContain(res.status());
      expect(text.includes("at ") && text.includes(".ts:")).toBe(false);
      expect(/DEEPSEEK_API_KEY|sk-[a-z0-9]{16,}/i.test(text)).toBe(false);
    }
  });

  test("UI.2 estratégia/minuta no browser (caso A)", async ({ page }) => {
    await page.goto(`/cases/${RT_CASE_A}/estrategia`);
    await expect(page).not.toHaveURL(/\/login/);
    const content = await page.content();
    expect(content.includes(SECRET_B)).toBe(false);
    expect(content.includes(BRAVO_CASE_TITLE)).toBe(false);
    if (page.url().includes(`/cases/${RT_CASE_A}`)) {
      await expect(page.getByText(/Estratégia/i).first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test("UI.3 logout", async ({ page }) => {
    await page.goto("/cases");
    await page.context().clearCookies();
    await page.goto("/cases");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("UI.4 DevTools — sem token/segredo na rede", async () => {
    expect(forbiddenInNetwork).toBe(false);
  });
});
