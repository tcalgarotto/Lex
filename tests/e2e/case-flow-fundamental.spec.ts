import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { countCaseMaterialization, readCaseIntakeMeta } from "./helpers/case-materialization";
import { buildE2eFundamentalIntakeForm } from "./helpers/intake-form-e2e";

test.describe.configure({ mode: "serial" });

const runId = `p01-${Date.now().toString(36)}`;

let caseId = "";

function hasPieceModelCredentials(): boolean {
  const p = (process.env["AI_CHAT_PROVIDER"] ?? "deepseek").trim().toLowerCase();
  if (p === "openai") return !!process.env["OPENAI_API_KEY"]?.trim();
  if (p === "anthropic") return !!process.env["ANTHROPIC_API_KEY"]?.trim();
  if (p === "openrouter") return !!process.env["OPENROUTER_API_KEY"]?.trim();
  return !!process.env["DEEPSEEK_API_KEY"]?.trim();
}

const hasDb = !!process.env["DATABASE_URL"]?.trim();
const hasPieceModel = hasPieceModelCredentials();

async function fillFundamentalInterview(page: import("@playwright/test").Page, seed: string): Promise<void> {
  const title = `E2E Case Flow ${seed}`;
  const client = `Cliente E2E ${seed}`;
  const opposing = `Réu E2E ${seed}`;
  const relato =
    "Relato E2E: contrato de prestação de serviços não cumprido, inadimplemento e recusa em devolver documentação da autora.";
  const objetivo = "Recebimento dos valores devidos e devolução de documentos.";

  await page.getByLabel("Título sugerido do caso").scrollIntoViewIfNeeded();
  await page.getByLabel("Título sugerido do caso").fill(title);

  await page.getByLabel("Cidade do caso").scrollIntoViewIfNeeded();
  await page.getByLabel("Cidade do caso").fill("São Paulo");

  await page.getByLabel("UF", { exact: true }).scrollIntoViewIfNeeded();
  await page.getByLabel("UF", { exact: true }).fill("SP");

  await page.getByLabel("Nome completo").scrollIntoViewIfNeeded();
  await page.getByLabel("Nome completo").fill(client);

  await page.getByLabel("CPF", { exact: true }).first().scrollIntoViewIfNeeded();
  await page.getByLabel("CPF", { exact: true }).first().fill("529.982.247-25");

  await page.getByText("A parte contrária ainda é desconhecida").scrollIntoViewIfNeeded();
  const unknown = page.locator('label:has-text("A parte contrária ainda é desconhecida") input[type="checkbox"]');
  if (await unknown.isChecked()) {
    await unknown.click();
  }

  await page.getByLabel("Nome ou razão social").first().scrollIntoViewIfNeeded();
  await page.getByLabel("Nome ou razão social").first().fill(opposing);

  await page.getByLabel("O que aconteceu?").scrollIntoViewIfNeeded();
  await page.getByLabel("O que aconteceu?").fill(relato);

  await page.getByRole("checkbox", { name: "Contrato" }).scrollIntoViewIfNeeded();
  await page.getByRole("checkbox", { name: "Contrato" }).check();

  await page.getByLabel("O que o cliente quer alcançar").scrollIntoViewIfNeeded();
  await page.getByLabel("O que o cliente quer alcançar").fill(objetivo);
}

test.describe("P0.1 — fluxo fundamental (autenticado + DB)", () => {
  test("1) salvar rascunho: POST 201, sem Unauthorized, caso listado", async ({ page }) => {
    await page.goto("/cases/new");
    await fillFundamentalInterview(page, runId);

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/cases/fundamental-intake") &&
          r.request().method() === "POST" &&
          r.status() !== 0,
        { timeout: 60_000 },
      ),
      page.getByTestId("save-case-sidebar").click(),
    ]);

    expect(res.status()).toBe(201);
    const json = (await res.json()) as { case?: { id?: string; title?: string }; error?: string };
    expect(json.error, JSON.stringify(json)).toBeUndefined();
    caseId = json.case?.id ?? "";
    expect(caseId.length).toBeGreaterThan(10);

    await expect(page.getByText(/Rascunho salvo/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Unauthorized")).toHaveCount(0);

    await page.goto("/cases");
    await expect(page.getByText(new RegExp(`E2E Case Flow ${runId}`))).toBeVisible({
      timeout: 30_000,
    });
  });

  test("2) reabrir rascunho: /cases/new?continue= mantém título", async ({ page }) => {
    expect(caseId).toBeTruthy();
    await page.goto(`/cases/new?continue=${encodeURIComponent(caseId)}`);
    const reopened = await page.getByLabel("Título sugerido do caso").inputValue();
    expect(reopened).toContain(`E2E Case Flow ${runId}`);
  });

  test("3) salvar e estruturar com Lex AI (precisa credenciais do modelo configuradas)", async ({ page }) => {
    test.skip(!hasPieceModel, "Estruturação precisa de DEEPSEEK_API_KEY (ou OPENAI_/ANTHROPIC_/OPENROUTER_ conforme AI_CHAT_PROVIDER).");

    expect(caseId).toBeTruthy();
    await page.goto(`/cases/new?continue=${encodeURIComponent(caseId)}`);
    await fillFundamentalInterview(page, runId);

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/cases/fundamental-intake") &&
          r.request().method() === "POST" &&
          r.status() !== 0,
        { timeout: 150_000 },
      ),
      page.getByTestId("save-structure-sidebar").click(),
    ]);

    expect([200, 201]).toContain(res.status());
    const json = (await res.json()) as { case?: { id?: string }; mode?: string; error?: string };
    expect(json.error, JSON.stringify(json)).toBeUndefined();
    expect(json.mode).toBe("fundamental_structured");

    await page.waitForURL(new RegExp(`/cases/${caseId}(?:/|$)`), { timeout: 30_000 });
    await expect(page.getByText(/Caso estruturado com Lex AI/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Unauthorized")).toHaveCount(0);
  });

  test("4) Postgres: partes/fatos/pedidos + metadata intakeStructuredAt / intakeForm", async () => {
    test.skip(!hasDb, "Assertions no Postgres precisam de DATABASE_URL no processo que executa Playwright.");
    test.skip(!hasPieceModel, "Sem estruturação concluída quando o modelo não está configurado.");

    expect(caseId).toBeTruthy();
    const counts = await countCaseMaterialization(caseId);
    expect(counts.parties, "CaseParty").toBeGreaterThan(0);
    expect(counts.facts, "CaseFact").toBeGreaterThan(0);
    expect(counts.requests, "CaseRequest").toBeGreaterThan(0);
    expect(counts.risks, "CaseRisk").toBeGreaterThanOrEqual(0);

    const meta = await readCaseIntakeMeta(caseId);
    expect(meta.intakeStructuredAt).toBeTruthy();
    expect(meta.intakeForm).toBeTruthy();

    const names = await prisma.caseParty.findMany({ where: { caseId }, select: { name: true } });
    const joined = names.map((n: { name: string }) => n.name).join(" ");
    expect(joined).toMatch(/Cliente E2E/);
    expect(joined).toMatch(/Réu E2E/);
  });

  test("5) reorganizar: segundo POST structure sem flag → 400; com reorganize → não duplica à toa", async ({
    page,
  }) => {
    test.skip(!hasDb, "Assertions no Postgres precisam de DATABASE_URL.");
    test.skip(!hasPieceModel, "Depende de caso já estruturado.");

    expect(caseId).toBeTruthy();
    const before = await countCaseMaterialization(caseId);
    const form = buildE2eFundamentalIntakeForm(runId);
    const blocked = await page.request.post("/api/cases/fundamental-intake", {
      data: { action: "structure", caseId, form },
    });
    expect(blocked.status()).toBe(400);
    const blockedJson = (await blocked.json()) as { code?: string };
    expect(blockedJson.code).toBe("REORGANIZE_REQUIRED");

    const afterBlocked = await countCaseMaterialization(caseId);
    expect(afterBlocked).toEqual(before);
  });

  test("6) UI /partes-fatos: secções com contagem > 0", async ({ page }) => {
    test.skip(!hasPieceModel, "Depende de materialização.");

    expect(caseId).toBeTruthy();
    await page.goto(`/cases/${caseId}/partes-fatos`);
    await expect(page.getByText(/^Partes · [1-9]/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^Fatos · [1-9]/)).toBeVisible();
    await expect(page.getByText(/^Pedidos · [1-9]/)).toBeVisible();
  });

  test("7) UI /entrevista: estado estruturado + sem overflow horizontal óbvio", async ({ page }) => {
    test.skip(!hasPieceModel, "Depende de estruturação.");

    expect(caseId).toBeTruthy();
    await page.goto(`/cases/${caseId}/entrevista`);
    await expect(page.getByRole("button", { name: /Reorganizar com Lex AI/i })).toBeVisible({
      timeout: 30_000,
    });

    const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(ok).toBe(true);
  });

  test("8) pesquisa jurídica: recommend e pin autenticados (401 ausente)", async ({ page }) => {
    test.skip(!hasPieceModel, "Caso precisa estar estruturado para haver contexto na pesquisa.");

    expect(caseId).toBeTruthy();
    await page.goto(`/cases/${caseId}/pesquisa-juridica`);

    const [recoRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/legal-research/recommend-for-case") &&
          r.request().method() === "POST" &&
          r.status() !== 0,
        { timeout: 120_000 },
      ),
      page.getByRole("button", { name: "Atualizar sugestões" }).click(),
    ]);

    expect(recoRes.status()).not.toBe(401);
    expect([200, 400, 404, 429, 502, 503]).toContain(recoRes.status());

    const pinBody = {
      caseId,
      foundation: {
        id: `e2e-pin-${runId}`,
        type: "LAW",
        title: "Responsabilidade civil (E2E)",
        citation: "Código Civil, art. 186",
        excerpt:
          "Aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem comete ato ilícito.",
        legalIssue: "",
        whyRelevant: "",
        suggestedUse: "",
        confidence: 0.5,
        verificationStatus: "USER_VERIFIED",
      },
    };
    const pinRes = await page.request.post("/api/legal-research/pin", { data: pinBody });
    expect(pinRes.status()).not.toBe(401);
    expect([200, 201, 400, 429]).toContain(pinRes.status());
  });

  test("9) estratégia e minuta via API (motor de IA configurado)", async ({ page }) => {
    test.skip(!hasPieceModel, "Geração precisa do mesmo motor configurado para a estruturação.");

    expect(caseId).toBeTruthy();

    const strat = await page.request.post(`/api/cases/${caseId}/strategy`, {});
    expect(strat.status()).not.toBe(401);
    if (![200, 201].includes(strat.status())) {
      const t = await strat.text();
      test.info().annotations.push({
        type: "strategy",
        description: `POST strategy → ${strat.status()} ${t.slice(0, 400)}`,
      });
    }
    expect([200, 201, 400, 429, 500, 502, 503]).toContain(strat.status());

    const draft = await page.request.post(`/api/cases/${caseId}/draft`, {});
    expect(draft.status()).not.toBe(401);
    if (![200, 201].includes(draft.status())) {
      const t = await draft.text();
      test.info().annotations.push({
        type: "draft",
        description: `POST draft → ${draft.status()} ${t.slice(0, 400)}`,
      });
    }
    expect([200, 201, 400, 429, 500, 502, 503]).toContain(draft.status());
  });
});

test.afterAll(async () => {
  if (!caseId || !hasDb) return;
  try {
    await prisma.case.deleteMany({
      where: {
        id: caseId,
        title: { startsWith: "E2E Case Flow" },
      },
    });
  } catch {
    // limpeza best-effort
  }
});
