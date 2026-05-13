import { describe, it, expect } from "vitest";
import {
  DATAJUD_ALIASES,
  DATAJUD_ALIAS_TOTALS,
  aliasesByCategory,
  getAliasEntry,
  listPriorityAliases,
  resolveDataJudAliasFromCnj,
  resolveDataJudAliasFromTribunalAcronym,
} from "./datajud-aliases";

describe("datajud aliases — cobertura completa CNJ", () => {
  it("lista canônica tem exatamente 91 tribunais", () => {
    expect(DATAJUD_ALIASES.length).toBe(91);
    expect(DATAJUD_ALIAS_TOTALS.total).toBe(91);
  });

  it("totais por categoria batem com a publicação CNJ", () => {
    expect(DATAJUD_ALIAS_TOTALS.superiores).toBe(4); // STJ, TST, TSE, STM
    expect(DATAJUD_ALIAS_TOTALS.trfs).toBe(6);
    expect(DATAJUD_ALIAS_TOTALS.tjs).toBe(27); // 26 estados + DF
    expect(DATAJUD_ALIAS_TOTALS.trts).toBe(24);
    expect(DATAJUD_ALIAS_TOTALS.tres).toBe(27); // 26 estados + DF
    expect(DATAJUD_ALIAS_TOTALS.tjms).toBe(3); // MG, RS, SP
  });

  it("todos os aliases começam com api_publica_", () => {
    for (const a of DATAJUD_ALIASES) {
      expect(a.alias.startsWith("api_publica_")).toBe(true);
    }
  });

  it("aliases são únicos", () => {
    const set = new Set(DATAJUD_ALIASES.map((a) => a.alias));
    expect(set.size).toBe(DATAJUD_ALIASES.length);
  });

  it("resolve aliases oficiais por sigla sem derivar string", () => {
    expect(resolveDataJudAliasFromTribunalAcronym("TJRS")).toBe("api_publica_tjrs");
    expect(resolveDataJudAliasFromTribunalAcronym("TJSC")).toBe("api_publica_tjsc");
    expect(resolveDataJudAliasFromTribunalAcronym("TJSP")).toBe("api_publica_tjsp");
    expect(resolveDataJudAliasFromTribunalAcronym("TJAM")).toBe("api_publica_tjam");
    expect(resolveDataJudAliasFromTribunalAcronym("TJAP")).toBe("api_publica_tjap");
    expect(resolveDataJudAliasFromTribunalAcronym("TJDFT")).toBe("api_publica_tjdft");
    expect(resolveDataJudAliasFromTribunalAcronym("TRF4")).toBe("api_publica_trf4");
    expect(resolveDataJudAliasFromTribunalAcronym("TRT12")).toBe("api_publica_trt12");
    expect(resolveDataJudAliasFromTribunalAcronym("TRE_SC")).toBe("api_publica_tre-sc");
    expect(resolveDataJudAliasFromTribunalAcronym("TRE_DFT")).toBe("api_publica_tre-df");
    expect(resolveDataJudAliasFromTribunalAcronym("TRE_DF")).toBe("api_publica_tre-df");
    expect(resolveDataJudAliasFromTribunalAcronym("STJ")).toBe("api_publica_stj");
    expect(resolveDataJudAliasFromTribunalAcronym("TJMMG")).toBe("api_publica_tjmmg");
  });

  it("resolve aliases a partir do CNJ usando segmento e tribunal", () => {
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.8.21.0001")).toBe("api_publica_tjrs");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.8.24.0001")).toBe("api_publica_tjsc");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.8.26.0100")).toBe("api_publica_tjsp");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.4.04.7000")).toBe("api_publica_trf4");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.5.12.0001")).toBe("api_publica_trt12");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.6.24.0001")).toBe("api_publica_tre-sc");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.9.13.0001")).toBe("api_publica_tjmmg");
    expect(resolveDataJudAliasFromCnj("0001234-56.2024.1.00.0000")).toBeNull();
  });

  it("inclui aliases-chave dos 4 superiores", () => {
    for (const alias of [
      "api_publica_stj",
      "api_publica_tst",
      "api_publica_tse",
      "api_publica_stm",
    ]) {
      const e = getAliasEntry(alias);
      expect(e).not.toBeNull();
      expect(e!.category).toMatch(/superior|trabalho|eleitoral|militar/);
    }
  });

  it("inclui todos os 27 TJs (UFs) — checagem amostral", () => {
    const tjs = aliasesByCategory().estadual;
    expect(tjs.length).toBe(27);
    const aliases = tjs.map((t) => t.alias);
    for (const alias of [
      "api_publica_tjac",
      "api_publica_tjsp",
      "api_publica_tjrj",
      "api_publica_tjmg",
      "api_publica_tjrs",
      "api_publica_tjdft",
      "api_publica_tjto",
    ]) {
      expect(aliases).toContain(alias);
    }
  });

  it("inclui TRT1..TRT24 sem buracos", () => {
    const trts = aliasesByCategory().trabalho.filter((t) => t.alias.startsWith("api_publica_trt"));
    expect(trts.length).toBe(24);
    for (let i = 1; i <= 24; i++) {
      const expected = `api_publica_trt${i}`;
      expect(trts.find((t) => t.alias === expected)).toBeDefined();
    }
  });

  it("inclui TRF1..TRF6 sem buracos", () => {
    const trfs = aliasesByCategory().trf;
    expect(trfs.length).toBe(6);
    for (let i = 1; i <= 6; i++) {
      const expected = `api_publica_trf${i}`;
      expect(trfs.find((t) => t.alias === expected)).toBeDefined();
    }
  });

  it("inclui os 3 TJMs estaduais (MG, RS, SP)", () => {
    const tjms = aliasesByCategory().militar_estadual;
    expect(tjms.length).toBe(3);
    expect(tjms.map((t) => t.alias)).toEqual(
      expect.arrayContaining([
        "api_publica_tjmmg",
        "api_publica_tjmrs",
        "api_publica_tjmsp",
      ]),
    );
  });

  it("inclui 27 TREs (estados + DF)", () => {
    const tres = aliasesByCategory().eleitoral.filter((t) =>
      t.alias.startsWith("api_publica_tre"),
    );
    expect(tres.length).toBe(27);
    expect(tres.map((t) => t.alias)).toEqual(
      expect.arrayContaining(["api_publica_tre-sc", "api_publica_tre-df"]),
    );
  });

  it("listPriorityAliases() retorna ordenado desc", () => {
    const sorted = listPriorityAliases();
    expect(sorted.length).toBe(91);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]!.priority).toBeGreaterThanOrEqual(sorted[i]!.priority);
    }
    // Top deve ser STJ (priority=100)
    expect(sorted[0]!.alias).toBe("api_publica_stj");
  });

  it("listPriorityAliases('estadual') só devolve TJs", () => {
    const tjs = listPriorityAliases("estadual");
    expect(tjs.every((t) => t.category === "estadual")).toBe(true);
    expect(tjs.length).toBe(27);
  });
});
