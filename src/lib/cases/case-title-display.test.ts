import { describe, expect, it } from "vitest";
import { getCasePrimaryTitle, splitCaseTitle } from "@/lib/cases/case-title-display";

describe("case-title-display", () => {
  it("splitCaseTitle separa em dash longo", () => {
    const t = "Maria Souza x Empresa Abc Ltda — Requer rescisão";
    expect(splitCaseTitle(t)).toEqual({
      primary: "Maria Souza x Empresa Abc Ltda",
      secondary: "Requer rescisão",
    });
    expect(getCasePrimaryTitle(t)).toBe("Maria Souza x Empresa Abc Ltda");
  });

  it("sem separador devolve o título inteiro", () => {
    const t = "Fulano x Beltrano";
    expect(getCasePrimaryTitle(t)).toBe("Fulano x Beltrano");
  });
});
