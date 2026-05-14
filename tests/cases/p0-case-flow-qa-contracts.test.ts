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
  it("middleware: fallback getSession + 401 com SESSION_REQUIRED em /api", () => {
    const m = read("src/proxy.ts");
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

  it("estruturação com caseId existente: persist rascunho antes da IA; 409 se já estruturado antes de DeepSeek", () => {
    const r = read("src/app/api/cases/fundamental-intake/route.ts");
    const elseIdx = r.indexOf("} else {");
    expect(elseIdx).toBeGreaterThan(-1);
    const elseBlock = r.slice(elseIdx, elseIdx + 900);
    const iPersist = elseBlock.indexOf("persistFundamentalDraft");
    const iDeepseek = elseBlock.indexOf("runDeepseekFundamentalStructure");
    const i409 = elseBlock.indexOf("intakeStructuredAt");
    expect(iPersist).toBeGreaterThan(-1);
    expect(iDeepseek).toBeGreaterThan(-1);
    expect(i409).toBeGreaterThan(-1);
    expect(iPersist).toBeLessThan(i409);
    expect(i409).toBeLessThan(iDeepseek);
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
