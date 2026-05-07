import { describe, expect, it } from "vitest";
import { classifyLegalIntent } from "./intent";
import { rewriteLegalQuery, stripToCoreTerms, toTsQueryString } from "./rewrite";

describe("rewriteLegalQuery", () => {
  it("expande CDC para forma canônica + sinônimos", () => {
    const variants = rewriteLegalQuery("o que diz o CDC sobre cláusula abusiva?");
    expect(variants[0]).toMatch(/CDC/);
    expect(variants.some((v) => v.includes("Código de Defesa do Consumidor"))).toBe(true);
    expect(variants.some((v) => v.includes("Lei 8078"))).toBe(true);
  });

  it("expande CF/88 para Constituição Federal", () => {
    const variants = rewriteLegalQuery("art. 5º da CF/88");
    expect(variants.some((v) => v.includes("Constituição Federal"))).toBe(true);
  });

  it("inclui article refs do intent quando relevante", () => {
    const intent = classifyLegalIntent("Art. 5º da CF/88");
    const variants = rewriteLegalQuery("Art. 5º da CF/88", intent);
    expect(variants.some((v) => /Art\.\s*5/.test(v))).toBe(true);
  });

  it("retorna lista vazia para query vazia", () => {
    expect(rewriteLegalQuery("")).toEqual([]);
    expect(rewriteLegalQuery("   ")).toEqual([]);
  });

  it("dedup: mesma string aparece só uma vez", () => {
    const variants = rewriteLegalQuery("Apenas texto sem alias");
    const unique = new Set(variants);
    expect(unique.size).toBe(variants.length);
  });
});

describe("stripToCoreTerms", () => {
  it("remove stopwords curtas mas mantém números", () => {
    expect(stripToCoreTerms("o que diz o art. 5 da CF/88 sobre direito")).toContain("art");
    expect(stripToCoreTerms("o que diz o art. 5 da CF/88 sobre direito")).toContain("88");
    expect(stripToCoreTerms("o que diz o art. 5 da CF/88 sobre direito")).not.toContain(" o ");
  });

  it("normaliza pontuação", () => {
    expect(stripToCoreTerms('"Art. 5º"')).not.toMatch(/["']/);
  });
});

describe("toTsQueryString", () => {
  it("remove operadores reservados", () => {
    expect(toTsQueryString("a & b | c : d * e ! f")).not.toMatch(/[&|:*!]/);
  });

  it("colapsa espaços", () => {
    expect(toTsQueryString("a    b   c")).toBe("a b c");
  });
});
