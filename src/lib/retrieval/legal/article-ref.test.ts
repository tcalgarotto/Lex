import { describe, expect, it } from "vitest";
import {
  articleRefEquals,
  articleRefIncludes,
  normalizeArticleRef,
  normalizeIncisoRef,
  normalizeParagraphRef,
} from "./article-ref";

describe("normalizeArticleRef", () => {
  it("normaliza variações comuns para forma canônica 'Art. N'", () => {
    expect(normalizeArticleRef("Art. 5º")).toBe("Art. 5");
    expect(normalizeArticleRef("art 5")).toBe("Art. 5");
    expect(normalizeArticleRef("Artigo 5")).toBe("Art. 5");
    expect(normalizeArticleRef("art.5")).toBe("Art. 5");
    expect(normalizeArticleRef("art. 005")).toBe("Art. 5");
  });
  it("retorna null para inputs sem número", () => {
    expect(normalizeArticleRef("artigo")).toBeNull();
    expect(normalizeArticleRef("")).toBeNull();
    expect(normalizeArticleRef(null)).toBeNull();
    expect(normalizeArticleRef(undefined)).toBeNull();
  });
});

describe("normalizeIncisoRef", () => {
  it("normaliza romanos para uppercase", () => {
    expect(normalizeIncisoRef("IV")).toBe("IV");
    expect(normalizeIncisoRef("inciso IV")).toBe("IV");
    expect(normalizeIncisoRef("inc. iv")).toBe("IV");
  });
});

describe("normalizeParagraphRef", () => {
  it("normaliza § com número", () => {
    expect(normalizeParagraphRef("§ 1º")).toBe("§ 1");
    expect(normalizeParagraphRef("§ 2")).toBe("§ 2");
    expect(normalizeParagraphRef("parágrafo 3")).toBe("§ 3");
  });
});

describe("articleRefEquals", () => {
  it("compara depois de normalizar", () => {
    expect(articleRefEquals("Art. 5º", "art 5")).toBe(true);
    expect(articleRefEquals("Art. 5º", "Art. 6º")).toBe(false);
    expect(articleRefEquals(null, "Art. 5º")).toBe(false);
  });
});

describe("articleRefIncludes", () => {
  it("encontra match em qualquer formato", () => {
    expect(articleRefIncludes(["Art. 5º", "Art. 7º"], "art 5")).toBe(true);
    expect(articleRefIncludes(["Art. 5º"], "Art. 6")).toBe(false);
    expect(articleRefIncludes([], "Art. 5º")).toBe(false);
  });
});
