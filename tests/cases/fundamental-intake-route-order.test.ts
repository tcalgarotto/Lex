import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/app/api/cases/fundamental-intake/route.ts"),
  "utf-8",
);

describe("POST /api/cases/fundamental-intake (ordem e cache)", () => {
  it("estruturação: persistFundamentalDraft antes de runDeepseekFundamentalStructure (save-first)", () => {
    const structureStart = SRC.indexOf("let caseId = body.caseId");
    expect(structureStart).toBeGreaterThan(-1);
    const slice = SRC.slice(structureStart, structureStart + 1200);
    const iPersist = slice.indexOf("persistFundamentalDraft");
    const iAi = slice.indexOf("runDeepseekFundamentalStructure");
    expect(iPersist).toBeGreaterThan(-1);
    expect(iAi).toBeGreaterThan(-1);
    expect(iPersist).toBeLessThan(iAi);
  });

  it("revalida rotas do caso após rascunho/estrutura", () => {
    expect(SRC).toMatch(/revalidatePath\("\/cases"\)/);
    expect(SRC).toMatch(/revalidateCaseSurface/);
  });
});
