import { describe, expect, it } from "vitest";
import { NormKind } from "@prisma/client";
import { buildCacheKey } from "./cache";

describe("buildCacheKey", () => {
  it("é determinístico para os mesmos inputs", () => {
    const a = buildCacheKey({
      query: "Art. 5º da CF/88",
      filters: { kinds: [NormKind.CONSTITUTION] },
      options: { topK: 8 },
    });
    const b = buildCacheKey({
      query: "Art. 5º da CF/88",
      filters: { kinds: [NormKind.CONSTITUTION] },
      options: { topK: 8 },
    });
    expect(a).toBe(b);
  });

  it("muda quando query muda", () => {
    const a = buildCacheKey({ query: "abc", options: { topK: 5 } });
    const b = buildCacheKey({ query: "abd", options: { topK: 5 } });
    expect(a).not.toBe(b);
  });

  it("é insensível a ordem de filtros", () => {
    const a = buildCacheKey({
      query: "x",
      filters: { kinds: [NormKind.CONSTITUTION, NormKind.ORDINARY_LAW] },
    });
    const b = buildCacheKey({
      query: "x",
      filters: { kinds: [NormKind.ORDINARY_LAW, NormKind.CONSTITUTION] },
    });
    expect(a).toBe(b);
  });

  it("é insensível a case da query", () => {
    const a = buildCacheKey({ query: "ABC" });
    const b = buildCacheKey({ query: "abc" });
    expect(a).toBe(b);
  });

  it("usa prefixo versionado", () => {
    expect(buildCacheKey({ query: "x" })).toMatch(/^lex:retrieval:legal:v2:/);
  });
});
