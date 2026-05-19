import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, "../../src/app/api/cases/fundamental-intake/route.ts"),
  "utf-8",
);
const SERVICE = fs.readFileSync(
  path.resolve(__dirname, "../../src/lib/cases/fundamental-intake/fundamental-intake-service.ts"),
  "utf-8",
);

describe("Lazy intake — save-first", () => {
  it("aceita action=save e action=draft sem chamar DeepSeek no ramo save", () => {
    expect(ROUTE).toMatch(/z\.enum\(\["draft", "save", "structure", "reorganize"\]\)/);
    expect(ROUTE).toMatch(/isSaveAction/);
    const saveStart = ROUTE.indexOf("if (isSaveAction(body.action))");
    const saveEnd = ROUTE.indexOf("let caseId = body.caseId");
    const saveBlock = ROUTE.slice(saveStart, saveEnd);
    expect(saveBlock.indexOf("persistFundamentalDraft")).toBeGreaterThan(-1);
    expect(saveBlock.indexOf("runDeepseekFundamentalStructure")).toBe(-1);
  });

  it("estruturação: persistFundamentalDraft antes de runDeepseekFundamentalStructure", () => {
    const structureStart = ROUTE.indexOf("let caseId = body.caseId");
    const slice = ROUTE.slice(structureStart, structureStart + 1200);
    const iPersist = slice.indexOf("persistFundamentalDraft");
    const iAi = slice.indexOf("runDeepseekFundamentalStructure");
    expect(iPersist).toBeGreaterThan(-1);
    expect(iAi).toBeGreaterThan(-1);
    expect(iPersist).toBeLessThan(iAi);
  });

  it("falha na organização devolve fundamental_saved + structureError quando caseId existe", () => {
    expect(ROUTE).toMatch(/structureError/);
    expect(ROUTE).toMatch(/structure_failed_case_saved/);
  });

  it("persistFundamentalDraft preenche uf, summary e intakeLegalArea", () => {
    expect(SERVICE).toMatch(/buildDeterministicCaseFieldsFromIntake/);
    expect(SERVICE).toMatch(/intakeLegalArea/);
    expect(SERVICE).toMatch(/Entrevista salva/);
  });
});
