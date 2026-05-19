import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

/**
 * Contratos estáticos do P0 Case Flow QA — não substituem E2E autenticado,
 * mas impedem regressões óbvias (ordem, 409, sessão, fetch com cookies).
 */
describe("P0 Case Flow QA — contratos no código-fonte", () => {
  it("middleware: getUser em /api; getSession só fora de /api; SESSION_REQUIRED", () => {
    const m = read("src/proxy.ts");
    expect(m).toMatch(/getUser\(\)/);
    expect(m).toMatch(/!isApiRoute/);
    expect(m).toMatch(/getSession\(\)/);
    expect(m).toMatch(/SESSION_REQUIRED/);
    expect(m).toMatch(/Sessão não encontrada ou expirou/);
  });

  it("POST checklist legado: 409 quando caso é fluxo fundamental", () => {
    const r = read("src/app/api/cases/[id]/checklist/route.ts");
    expect(r).toMatch(/usesFundamentalIntakeFlow/);
    expect(r).toMatch(/status:\s*409/);
  });

  it("pesquisa jurídica (tab): todos os fetch mutáveis usam credentials include", () => {
    const r = read("src/components/cases/research/case-research-tab.tsx");
    const n = (r.match(/credentials:\s*["']include["']/g) ?? []).length;
    expect(n).toBeGreaterThanOrEqual(4);
  });

  it("estruturação: persist antes da IA; REORGANIZE_REQUIRED se já organizado sem flag", () => {
    const r = read("src/app/api/cases/fundamental-intake/route.ts");
    const structureStart = r.indexOf("let caseId = body.caseId");
    expect(structureStart).toBeGreaterThan(-1);
    const block = r.slice(structureStart, structureStart + 1200);
    const iPersist = block.indexOf("persistFundamentalDraft");
    const iGate = block.indexOf("REORGANIZE_REQUIRED");
    const iDeepseek = block.indexOf("runDeepseekFundamentalStructure");
    expect(iPersist).toBeLessThan(iGate);
    expect(iGate).toBeLessThan(iDeepseek);
    expect(r).not.toMatch(/já foi organizado a partir da entrevista fundamental/);
  });

  it("UI entrevista: botão primário Salvar caso", () => {
    const chrome = read("src/components/cases/fundamental-intake-chrome.tsx");
    expect(chrome).toMatch(/data-testid="save-case-sidebar"/);
    expect(chrome).toMatch(/Salvar caso/);
    expect(chrome).toMatch(/Organizar caso com Lex AI/);
  });

  it("applyFundamentalStructure: dedupe de partes por role+name antes de createMany", () => {
    const s = read("src/lib/cases/fundamental-intake/fundamental-intake-service.ts");
    expect(s).toMatch(/partyKeys/);
    expect(s).toMatch(/partiesToCreate/);
  });

  it("entrevista no caso: página passa mode embedded ao formulário", () => {
    const p = read("src/app/(app)/cases/[id]/entrevista/page.tsx");
    expect(p).toMatch(/mode="embedded"/);
  });

  it("formulário fundamental: refresh após POST bem-sucedido", () => {
    const f = read("src/components/cases/fundamental-intake-form.tsx");
    expect(f).toMatch(/router\.refresh\(\)/);
  });
});
