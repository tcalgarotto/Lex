import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { readCaseIntakeMeta } from "./helpers/case-materialization";

test.describe.configure({ mode: "serial" });

const runId = `lazy-p02-${Date.now().toString(36)}`;
let caseId = "";

const hasDb = !!process.env["DATABASE_URL"]?.trim();

async function fillMinimalInterview(page: import("@playwright/test").Page, seed: string): Promise<void> {
  await page.getByLabel("Título sugerido do caso").fill(`Lazy P0.2 ${seed}`);
  await page.getByLabel("Cidade do caso").fill("São Paulo");
  await page.getByLabel("UF", { exact: true }).fill("SP");
  await page.getByLabel("Nome completo").fill(`Cliente ${seed}`);
  await page.getByLabel("CPF", { exact: true }).first().fill("529.982.247-25");
  const unknown = page.locator('label:has-text("A parte contrária ainda é desconhecida") input[type="checkbox"]');
  if (await unknown.isChecked()) await unknown.click();
  await page.getByLabel("Nome ou razão social").first().fill(`Réu ${seed}`);
  await page.getByLabel("O que aconteceu?").fill(
    "Relato: inadimplemento contratual e recusa em devolver documentação.",
  );
  await page.getByRole("checkbox", { name: "Contrato" }).check();
  await page.getByLabel("O que o cliente quer alcançar").fill("Recebimento dos valores devidos.");
}

test.describe("P0.2 — Lazy intake (salvar sem organizar)", () => {
  test("1) salvar caso sem organizar com Lex AI", async ({ page }) => {
    await page.goto("/cases/new");
    await fillMinimalInterview(page, runId);

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
    const json = (await res.json()) as { case?: { id?: string }; mode?: string };
    caseId = json.case?.id ?? "";
    expect(caseId.length).toBeGreaterThan(10);
    expect(json.mode).toBe("fundamental_saved");
    await expect(page.getByText(/Caso salvo/i)).toBeVisible({ timeout: 20_000 });
  });

  test("2) metadata sem intakeStructuredAt após só salvar", async () => {
    test.skip(!hasDb, "Precisa DATABASE_URL para ler metadataJson.");
    expect(caseId).toBeTruthy();
    const meta = await readCaseIntakeMeta(caseId);
    expect(meta.intakeForm).toBeTruthy();
    expect(meta.intakeStructuredAt).toBeFalsy();
  });

  test("3) estratégia/minuta: sem bloqueio indevido por partes/fatos vazios no Prisma", async ({
    page,
  }) => {
    test.skip(!hasDb, "Precisa DATABASE_URL.");
    expect(caseId).toBeTruthy();

    const parties = await prisma.caseParty.count({ where: { caseId } });
    const facts = await prisma.caseFact.count({ where: { caseId } });
    expect(parties).toBe(0);
    expect(facts).toBe(0);

    await page.goto(`/cases/${caseId}/estrategia`);
    await expect(
      page.getByText(/Informe ao menos a parte autora na entrevista ou em Partes e fatos/i),
    ).toHaveCount(0);
  });

  test("4) pesquisa jurídica acessível sem intakeStructuredAt (≠ 401)", async ({ page }) => {
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
  });
});

test.afterAll(async () => {
  if (!caseId || !hasDb) return;
  try {
    await prisma.case.deleteMany({
      where: { id: caseId, title: { startsWith: "Lazy P0.2" } },
    });
  } catch {
    // limpeza best-effort
  }
});
