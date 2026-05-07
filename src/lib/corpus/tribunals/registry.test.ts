import { describe, expect, it } from "vitest";
import {
  TRIBUNALS,
  getTribunal,
  listTribunalCodes,
  primaryRegionalForUf,
  tribunalsByTier,
  tribunalsByUf,
} from "./registry";

describe("tribunal registry", () => {
  it("contém 92 tribunais (5 superiores + 6 TRFs + 24 TRTs + 27 TJs + 27 TREs + 3 TJMs)", () => {
    expect(TRIBUNALS.length).toBe(5 + 6 + 24 + 27 + 27 + 3);
  });

  it("contém os 5 tribunais superiores corretos (STF, STJ, TST, TSE, STM)", () => {
    const superiores = tribunalsByTier("SUPERIOR").map((t) => t.code).sort();
    expect(superiores).toEqual(["STF", "STJ", "STM", "TSE", "TST"]);
  });

  it("STF tem URN authority 'supremo.tribunal.federal'", () => {
    expect(getTribunal("STF")?.urnAuthority).toBe("supremo.tribunal.federal");
  });

  it("TJSP tem jurisdiction STATE e UF=SP", () => {
    const t = getTribunal("TJSP");
    expect(t?.jurisdiction).toBe("STATE");
    expect(t?.uf).toBe("SP");
  });

  it("TJDF tem jurisdiction FEDERAL (DF é federal)", () => {
    expect(getTribunal("TJDF")?.jurisdiction).toBe("FEDERAL");
  });

  it("TRF4 tem circuit=4 e UF=RS", () => {
    const t = getTribunal("TRF4");
    expect(t?.circuit).toBe(4);
    expect(t?.uf).toBe("RS");
  });

  it("getTribunal aceita lowercase", () => {
    expect(getTribunal("trf4")?.code).toBe("TRF4");
  });

  it("getTribunal devolve null pra código inexistente", () => {
    expect(getTribunal("TJZZ")).toBeNull();
  });

  it("listTribunalCodes contém siglas únicas", () => {
    const codes = listTribunalCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("tribunalsByUf SP retorna TJ, TRF, TRT e TRE de SP", () => {
    const sp = tribunalsByUf("SP");
    const tiers = sp.map((t) => t.tier).sort();
    expect(tiers).toContain("TJ");
    expect(tiers).toContain("TRT");
    expect(tiers).toContain("TRE");
    // TRF3 é hub SP — confirma
    expect(sp.some((t) => t.code === "TRF3")).toBe(true);
  });

  it("primaryRegionalForUf RS devolve TJ + TRF + TRT + TRE", () => {
    const r = primaryRegionalForUf("RS");
    expect(r.tj?.code).toBe("TJRS");
    expect(r.trf?.code).toBe("TRF4");
    expect(r.trt?.code).toBe("TRT4");
    expect(r.tre?.code).toBe("TRERS");
  });

  it("não há códigos duplicados entre tiers", () => {
    const codes = TRIBUNALS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("cada TRT tem circuit válido (1..24)", () => {
    const trts = tribunalsByTier("TRT");
    expect(trts.length).toBe(24);
    expect(trts.every((t) => typeof t.circuit === "number" && t.circuit! >= 1 && t.circuit! <= 24)).toBe(true);
    const circuits = trts.map((t) => t.circuit!).sort((a, b) => a - b);
    expect(circuits).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  });

  it("cada TJ tem authority normalizado (lowercase, ponto-separado)", () => {
    const tjs = tribunalsByTier("TJ");
    expect(tjs.length).toBe(27);
    expect(tjs.every((t) => /^tribunal\.justica\.[a-z0-9.]+$/.test(t.urnAuthority))).toBe(true);
  });
});
