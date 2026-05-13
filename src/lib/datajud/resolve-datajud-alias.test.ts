import { describe, expect, it } from "vitest";
import { formatCnj, isValidCnj, parseCnj, resolveDataJudAlias } from "./resolve-datajud-alias";

describe("resolve-datajud-alias", () => {
  it("valida e formata CNJ com digito verificador real", () => {
    const cnj = "0001234-18.2024.8.21.0001";
    expect(isValidCnj(cnj)).toBe(true);
    expect(formatCnj("00012341820248210001")).toBe(cnj);
  });

  it("rejeita CNJ com digito verificador invalido", () => {
    expect(isValidCnj("0001234-56.2024.8.21.0001")).toBe(false);
    expect(resolveDataJudAlias({ cnj: "0001234-56.2024.8.21.0001" }).ok).toBe(false);
  });

  it("resolve tribunal por CNJ valido sem inventar alias", () => {
    const parsed = parseCnj("0001234-18.2024.8.21.0001");
    expect(parsed?.tribunalAcronym).toBe("TJRS");
    const resolution = resolveDataJudAlias({ cnj: "0001234-18.2024.8.21.0001" });
    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.alias).toBe("api_publica_tjrs");
      expect(resolution.source).toBe("cnj");
    }
  });
});
