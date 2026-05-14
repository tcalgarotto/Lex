import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "../../src/app/api/cases/fundamental-intake/route.ts"),
  "utf-8",
);

describe("POST /api/cases/fundamental-intake (ordem e cache)", () => {
  it("novo caso (!caseId): DeepSeek antes de persistFundamentalDraft — falha da IA não cria caso", () => {
    const head = "if (!caseId)";
    const i = SRC.indexOf(head);
    expect(i).toBeGreaterThan(-1);
    const slice = SRC.slice(i, i + 800);
    const iAi = slice.indexOf("runDeepseekFundamentalStructure");
    const iPersist = slice.indexOf("persistFundamentalDraft");
    expect(iAi).toBeGreaterThan(-1);
    expect(iPersist).toBeGreaterThan(-1);
    expect(iAi).toBeLessThan(iPersist);
  });

  it("revalida rotas do caso após rascunho/estrutura", () => {
    expect(SRC).toMatch(/revalidatePath\("\/cases"\)/);
    expect(SRC).toMatch(/revalidateCaseSurface/);
  });
});
