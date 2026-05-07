import { describe, expect, it } from "vitest";
import { canonicalizeForHash, normalizeLegalText } from "./normalize";

describe("normalizeLegalText", () => {
  it("aplica NFC e remove zero-width", () => {
    const dirty = "Art\u200B. 5\u00BA\u200D\u00A0— direitos";
    const clean = normalizeLegalText(dirty);
    expect(clean).toMatch(/^Art\. 5º — direitos$/);
  });

  it("normaliza referência a artigo", () => {
    expect(normalizeLegalText("art 1")).toBe("Art. 1º");
    expect(normalizeLegalText("Artigo 5")).toBe("Art. 5º");
    expect(normalizeLegalText("Art.5°")).toBe("Art. 5º");
  });

  it("canonicaliza Parágrafo único", () => {
    expect(normalizeLegalText("Paragrafo Unico — vedação")).toBe(
      "Parágrafo único — vedação",
    );
  });

  it("canonicaliza caput preservando case", () => {
    expect(normalizeLegalText("CAPUT do Art. 5")).toBe("caput do Art. 5º");
  });

  it("colapsa quebras múltiplas para no máximo uma linha em branco", () => {
    const input = "linha 1\n\n\n\nlinha 2";
    expect(normalizeLegalText(input)).toBe("linha 1\n\nlinha 2");
  });

  it("colapsa espaços e tabs", () => {
    expect(normalizeLegalText("a   b\t\tc")).toBe("a b c");
  });

  it("é idempotente", () => {
    const once = normalizeLegalText("Art 5°  —  caput");
    const twice = normalizeLegalText(once);
    expect(twice).toBe(once);
  });
});

describe("canonicalizeForHash", () => {
  it("zera variações cosméticas", () => {
    const a = canonicalizeForHash('Art. 5º — "tese" jurídica');
    const b = canonicalizeForHash("Art 5° - tese juridica");
    // Não exigimos igualdade total (mantemos acentos pra significado),
    // mas exigimos que a versão A normalize aspas e mantenha forma estável.
    expect(a).toContain("art. 5º");
    expect(a).not.toContain('"');
    expect(b).toContain("art. 5º");
  });

  it("agressivo: case-insensitive", () => {
    expect(canonicalizeForHash("ABC")).toBe("abc");
  });
});
