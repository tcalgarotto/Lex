import { describe, it, expect } from "vitest";
import { buildDatajudListQuery } from "./datajud";
import { DATAJUD_ALIASES, getAliasEntry, listPriorityAliases } from "./datajud-aliases";

describe("datajud query builder", () => {
  it("match_all quando sem filtros", () => {
    const q = buildDatajudListQuery({ size: 10 });
    expect(q["size"]).toBe(10);
    expect(q["query"]).toEqual({ match_all: {} });
    expect(q["sort"]).toBeDefined();
  });

  it("inclui tribunal/grau quando informados", () => {
    const q = buildDatajudListQuery({
      size: 5,
      tribunal: "TJSP",
      grau: "G1",
    });
    const must = (q["query"] as { bool?: { must?: unknown[] } }).bool?.must ?? [];
    expect(must.length).toBe(2);
  });

  it("aceita range de dataAjuizamento", () => {
    const q = buildDatajudListQuery({
      size: 5,
      dataAjuizamentoFrom: "2024-01-01",
      dataAjuizamentoTo: "2024-12-31",
    });
    const must = (q["query"] as { bool?: { must?: Array<Record<string, unknown>> } }).bool?.must ?? [];
    const range = must.find((m) => "range" in m);
    expect(range).toBeDefined();
  });

  it("limpa dígitos do número de processo", () => {
    const q = buildDatajudListQuery({
      size: 1,
      numeroProcesso: "0001234-56.2020.8.26.0100",
    });
    const must = (q["query"] as { bool?: { must?: Array<{ match?: { numeroProcesso?: string } }> } }).bool?.must ?? [];
    const proc = must.find((m) => m.match?.numeroProcesso !== undefined);
    expect(proc?.match?.numeroProcesso).toBe("00012345620208260100");
  });

  it("parses search_after válido como cursor", () => {
    const cursor = JSON.stringify(["2024-01-01T00:00:00Z", "id-1"]);
    const q = buildDatajudListQuery({ size: 1, cursor });
    expect(q["search_after"]).toEqual(["2024-01-01T00:00:00Z", "id-1"]);
  });

  it("ignora cursor inválido sem lançar", () => {
    const q = buildDatajudListQuery({ size: 1, cursor: "{not-json}" });
    expect(q["search_after"]).toBeUndefined();
  });
});

describe("datajud aliases registry", () => {
  it("lista contém STJ, STF, TJSP, TRF4", () => {
    expect(DATAJUD_ALIASES.find((a) => a.alias === "api_publica_stj")).toBeDefined();
    expect(DATAJUD_ALIASES.find((a) => a.alias === "api_publica_tjsp")).toBeDefined();
    expect(DATAJUD_ALIASES.find((a) => a.alias === "api_publica_trf4")).toBeDefined();
  });

  it("getAliasEntry retorna entry ou null", () => {
    expect(getAliasEntry("api_publica_tjsp")?.tribunal).toBe("TJSP");
    expect(getAliasEntry("inexistente")).toBeNull();
  });

  it("listPriorityAliases ordena por priority desc", () => {
    const sorted = listPriorityAliases();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]!.priority).toBeGreaterThanOrEqual(sorted[i]!.priority);
    }
  });

  it("filtra por categoria", () => {
    const trfs = listPriorityAliases("trf");
    expect(trfs.length).toBeGreaterThanOrEqual(5);
    expect(trfs.every((a) => a.category === "trf")).toBe(true);
  });
});
