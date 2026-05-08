import { describe, expect, it } from "vitest";
import {
  OFFICIAL_LAWS,
  OFFICIAL_LAWS_BY_KEY,
  filterLawsByKeys,
  findLawByQuery,
} from "./catalog";

describe("OFFICIAL_LAWS catalog", () => {
  it("inclui as 15 leis principais cobrindo o Brasil federal", () => {
    expect(OFFICIAL_LAWS.length).toBe(15);
  });

  it("toda lei tem sourceUrl no domínio www.planalto.gov.br", () => {
    for (const l of OFFICIAL_LAWS) {
      expect(l.sourceUrl).toMatch(/^https:\/\/www\.planalto\.gov\.br\//);
    }
  });

  it("toda lei tem URN canônica no formato urn:lex:br:...", () => {
    for (const l of OFFICIAL_LAWS) {
      expect(l.urn).toMatch(/^urn:lex:br:[a-z\.]+:[a-z\-]+:\d{4}-\d{2}-\d{2};\d+$/);
    }
  });

  it("toda lei tem identifier não-vazio", () => {
    for (const l of OFFICIAL_LAWS) {
      expect(l.identifier).toBeTruthy();
      expect(l.identifier.length).toBeGreaterThan(2);
    }
  });

  it("toda lei tem expectedArticleCount com min < max", () => {
    for (const l of OFFICIAL_LAWS) {
      expect(l.expectedArticleCount.min).toBeLessThan(l.expectedArticleCount.max);
      expect(l.expectedArticleCount.min).toBeGreaterThan(0);
    }
  });

  it("toda lei tem aliases não-vazios", () => {
    for (const l of OFFICIAL_LAWS) {
      expect(l.aliases.length).toBeGreaterThan(0);
    }
  });

  it("Lei Maria da Penha está presente", () => {
    const lmp = OFFICIAL_LAWS_BY_KEY["LMP"];
    expect(lmp).toBeDefined();
    expect(lmp?.identifier).toBe("Lei 11.340/2006");
    expect(lmp?.aliases).toContain("lei maria da penha");
    expect(lmp?.aliases).toContain("medida protetiva");
  });

  it("CPC, CDC, CC, CLT, CP, CPP estão presentes", () => {
    for (const key of ["CPC2015", "CDC", "CC2002", "CLT", "CP", "CPP"]) {
      expect(OFFICIAL_LAWS_BY_KEY[key]).toBeDefined();
    }
  });

  it("CF/1988 tem prioridade máxima", () => {
    const cf = OFFICIAL_LAWS_BY_KEY["CF1988"];
    expect(cf).toBeDefined();
    const others = OFFICIAL_LAWS.filter((l) => l.key !== "CF1988");
    for (const l of others) {
      expect(cf!.priority).toBeGreaterThanOrEqual(l.priority);
    }
  });

  it("URNs são únicas no catálogo", () => {
    const urns = OFFICIAL_LAWS.map((l) => l.urn);
    expect(new Set(urns).size).toBe(urns.length);
  });

  it("keys são únicas no catálogo", () => {
    const keys = OFFICIAL_LAWS.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("findLawByQuery", () => {
  it("encontra por key (case-insensitive)", () => {
    expect(findLawByQuery("lmp")?.identifier).toBe("Lei 11.340/2006");
    expect(findLawByQuery("CPC2015")?.shortTitle).toBe("Código de Processo Civil");
  });

  it("encontra por identifier", () => {
    expect(findLawByQuery("Lei 11.340/2006")?.key).toBe("LMP");
  });

  it("encontra por alias", () => {
    expect(findLawByQuery("lei maria da penha")?.key).toBe("LMP");
    expect(findLawByQuery("medida protetiva")?.key).toBe("LMP");
    expect(findLawByQuery("CPC")?.key).toBe("CPC2015");
    expect(findLawByQuery("LGPD")?.key).toBe("LGPD");
  });

  it("retorna undefined pra query desconhecida", () => {
    expect(findLawByQuery("lei do bigode")).toBeUndefined();
  });
});

describe("filterLawsByKeys", () => {
  it("retorna catálogo inteiro com lista vazia", () => {
    expect(filterLawsByKeys([]).length).toBe(OFFICIAL_LAWS.length);
  });

  it("filtra por keys (case-insensitive)", () => {
    const r = filterLawsByKeys(["cpc2015", "cdc", "cc2002"]);
    expect(r.length).toBe(3);
    expect(r.map((l) => l.key).sort()).toEqual(["CC2002", "CDC", "CPC2015"]);
  });

  it("ignora keys desconhecidos sem quebrar", () => {
    const r = filterLawsByKeys(["xyz", "cpc2015"]);
    expect(r.length).toBe(1);
  });
});
