import { describe, expect, it } from "vitest";
import { CorpusProvider } from "@prisma/client";
import {
  DEMO_TOKEN_REGEX,
  isProductionVisibleSource,
  legalChunkProductionWhere,
  legalNormProductionWhere,
  legalSourceProductionRawSql,
  legalSourceProductionWhere,
  shouldBypassDemoVisibility,
} from "./source-visibility";

describe("isProductionVisibleSource", () => {
  it("rejeita os 3 LegalSource DEMO observados em produção", () => {
    expect(isProductionVisibleSource({ code: "STF-RE-DEMO-1" })).toBe(false);
    expect(isProductionVisibleSource({ code: "STJ-RESP-DEMO-1" })).toBe(false);
    expect(isProductionVisibleSource({ code: "STJ-AGR-DEMO-1" })).toBe(false);
  });

  it("rejeita variações de caixa", () => {
    expect(isProductionVisibleSource({ code: "demo-stf-1" })).toBe(false);
    expect(isProductionVisibleSource({ code: "FixTuRe-stj-1" })).toBe(false);
    expect(isProductionVisibleSource({ title: "Lei Exemplo de Teste" })).toBe(false);
  });

  it("rejeita LegalNorm com sourceProvider=FIXTURE", () => {
    expect(
      isProductionVisibleSource({
        code: "SV-14",
        title: "Súmula Vinculante 14",
        sourceProvider: CorpusProvider.FIXTURE,
      }),
    ).toBe(false);
  });

  it("rejeita por tags demo/test/fixture", () => {
    expect(isProductionVisibleSource({ code: "CPC-1", tags: ["legislacao", "demo"] })).toBe(false);
    expect(isProductionVisibleSource({ code: "CPC-1", tags: ["TEST"] })).toBe(false);
  });

  it("aceita códigos reais de produção", () => {
    expect(
      isProductionVisibleSource({
        code: "CPC",
        title: "Código de Processo Civil (Lei nº 13.105/2015)",
        sourceProvider: CorpusProvider.MANUAL,
      }),
    ).toBe(true);
    expect(
      isProductionVisibleSource({
        code: "CDC-Art-18",
        title: "Código de Defesa do Consumidor",
        sourceProvider: CorpusProvider.PLANALTO,
      }),
    ).toBe(true);
    expect(
      isProductionVisibleSource({
        identifier: "Lei 11.340/2006",
        title: "Lei Maria da Penha",
        sourceProvider: CorpusProvider.MANUAL,
      }),
    ).toBe(true);
  });

  it("aceita quando todos os campos opcionais são nulos", () => {
    expect(isProductionVisibleSource({})).toBe(true);
    expect(
      isProductionVisibleSource({ code: null, title: null, identifier: null, tags: null }),
    ).toBe(true);
  });
});

describe("DEMO_TOKEN_REGEX", () => {
  it("casa todos os tokens definidos", () => {
    expect(DEMO_TOKEN_REGEX.test("DEMO")).toBe(true);
    expect(DEMO_TOKEN_REGEX.test("FIXTURE")).toBe(true);
    expect(DEMO_TOKEN_REGEX.test("TESTE")).toBe(true);
    expect(DEMO_TOKEN_REGEX.test("EXEMPLO")).toBe(true);
    expect(DEMO_TOKEN_REGEX.test("PLACEHOLDER")).toBe(true);
    expect(DEMO_TOKEN_REGEX.test("STF-RE-DEMO-99")).toBe(true);
  });

  it("não casa códigos reais (CPC, CDC, LMP, etc.)", () => {
    expect(DEMO_TOKEN_REGEX.test("CPC")).toBe(false);
    expect(DEMO_TOKEN_REGEX.test("CDC")).toBe(false);
    expect(DEMO_TOKEN_REGEX.test("Lei 11.340/2006")).toBe(false);
    expect(DEMO_TOKEN_REGEX.test("Constituição Federal")).toBe(false);
  });
});

describe("legalSourceProductionWhere", () => {
  it("retorna AND com NOT { code: { contains, mode } } para todos os tokens", () => {
    const where = legalSourceProductionWhere();
    expect(where.AND).toBeDefined();
    expect(Array.isArray(where.AND)).toBe(true);
    const arr = where.AND as Array<{ NOT: { code: { contains: string; mode: string } } }>;
    const tokens = arr.map((c) => c.NOT.code.contains);
    expect(tokens).toContain("DEMO");
    expect(tokens).toContain("FIXTURE");
    expect(tokens).toContain("STF-RE-DEMO");
    expect(tokens).toContain("STJ-RESP-DEMO");
    expect(tokens).toContain("STJ-AGR-DEMO");
    for (const c of arr) {
      expect(c.NOT.code.mode).toBe("insensitive");
    }
  });
});

describe("legalNormProductionWhere", () => {
  it("encadeia filtro de FIXTURE + identifier/title sem DEMO", () => {
    const where = legalNormProductionWhere();
    expect(Array.isArray(where.AND)).toBe(true);
    const arr = where.AND as Array<Record<string, unknown>>;
    const hasFixtureBlock = arr.some(
      (c) =>
        c.sourceProvider !== undefined &&
        JSON.stringify(c.sourceProvider).includes("FIXTURE"),
    );
    expect(hasFixtureBlock).toBe(true);
  });
});

describe("legalChunkProductionWhere", () => {
  it("delega ao filtro de LegalNorm via relação `norm`", () => {
    const where = legalChunkProductionWhere();
    expect(where.norm).toBeDefined();
  });
});

describe("legalSourceProductionRawSql", () => {
  it("monta fragmento Prisma.sql sem expor valores diretamente", () => {
    const fragment = legalSourceProductionRawSql();
    // Prisma.sql produz uma instância de Sql com `strings` e `values`.
    expect(typeof (fragment as unknown as { strings?: unknown }).strings).toBe("object");
    expect(Array.isArray((fragment as unknown as { values?: unknown }).values)).toBe(true);
  });
});

describe("shouldBypassDemoVisibility", () => {
  it("retorna true em dev/preview", () => {
    expect(shouldBypassDemoVisibility({ isProduction: false })).toBe(true);
  });

  it("retorna true quando ?all=1", () => {
    const sp = new URLSearchParams("all=1");
    expect(shouldBypassDemoVisibility({ searchParams: sp, isProduction: true })).toBe(true);
  });

  it("retorna true em rotas /demo/*", () => {
    expect(
      shouldBypassDemoVisibility({ pathname: "/demo/biblioteca", isProduction: true }),
    ).toBe(true);
  });

  it("retorna false em rota normal de produção", () => {
    expect(
      shouldBypassDemoVisibility({
        pathname: "/biblioteca",
        searchParams: new URLSearchParams(),
        isProduction: true,
      }),
    ).toBe(false);
  });

  it("aceita objeto plano com .all (Next.js searchParams)", () => {
    expect(
      shouldBypassDemoVisibility({ searchParams: { all: "1" }, isProduction: true }),
    ).toBe(true);
    expect(
      shouldBypassDemoVisibility({ searchParams: { all: null }, isProduction: true }),
    ).toBe(false);
  });
});
