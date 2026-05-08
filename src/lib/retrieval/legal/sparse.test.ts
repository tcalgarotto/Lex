import { describe, expect, it } from "vitest";
import {
  buildLegalSparseQuery,
  buildLegalSparseVector,
  normalizeLegalToken,
  SPARSE_DIMENSION,
  stableSparseIndex,
  tokenizeLegal,
} from "./sparse";

describe("normalizeLegalToken", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeLegalToken("Constituição")).toBe("constituicao");
    expect(normalizeLegalToken("ÁGUA")).toBe("agua");
  });

  it("removes punctuation but keeps digits and underscore", () => {
    expect(normalizeLegalToken("art_5")).toBe("art_5");
    expect(normalizeLegalToken("art. 5")).toBe("art5"); // tokens passam pré-normalizados
    expect(normalizeLegalToken("paragrafo_unico")).toBe("paragrafo_unico");
  });
});

describe("stableSparseIndex", () => {
  it("is deterministic across calls", () => {
    const a = stableSparseIndex("art_5");
    const b = stableSparseIndex("art_5");
    expect(a).toBe(b);
  });

  it("stays in [0, SPARSE_DIMENSION)", () => {
    for (const t of ["cf", "adct", "art_92", "inciso_lv", "devido_processo_legal"]) {
      const idx = stableSparseIndex(t);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(SPARSE_DIMENSION);
    }
  });

  it("differs for distinct terms (no trivial collisions)", () => {
    const seen = new Set<number>();
    const terms = [
      "art_1", "art_5", "art_22", "art_37", "art_92", "art_100",
      "art_218", "art_219", "art_235", "cf", "adct",
      "dignidade", "devido", "processo", "legal",
      "contraditorio", "ampla", "defesa",
      "ciencia", "tecnologia", "inovacao",
    ];
    for (const t of terms) seen.add(stableSparseIndex(t));
    // Sem colisão entre termos canônicos do briefing.
    expect(seen.size).toBe(terms.length);
  });
});

describe("tokenizeLegal", () => {
  it("emits canonical n-grams for art + numero", () => {
    const tokens = tokenizeLegal("Art. 5º, LIV — devido processo legal");
    expect(tokens).toContain("art");
    expect(tokens).toContain("5");
    expect(tokens).toContain("art_5");
    // Trigram art_5_liv
    expect(tokens).toContain("art_5_liv");
    expect(tokens).toContain("devido");
    expect(tokens).toContain("processo");
    expect(tokens).toContain("legal");
  });

  it("emits paragrafo n-gram", () => {
    const t = tokenizeLegal("§ 2º do art. 37");
    expect(t).toContain("paragrafo");
    expect(t).toContain("2");
    expect(t).toContain("paragrafo_2");
    expect(t).toContain("art");
    expect(t).toContain("37");
    expect(t).toContain("art_37");
  });

  it("emits inciso n-gram (roman)", () => {
    const t = tokenizeLegal("inciso LV do artigo 5º");
    expect(t).toContain("inciso");
    expect(t).toContain("lv");
    expect(t).toContain("inciso_lv");
  });

  it("handles paragrafo unico", () => {
    const t = tokenizeLegal("§ único do art. 1");
    expect(t).toContain("paragrafo");
    expect(t).toContain("paragrafo_unico");
  });

  it("strips stopwords", () => {
    const t = tokenizeLegal("o de da com e ou");
    // todos stopwords — saída vazia
    expect(t).toEqual([]);
  });

  it("normalizes accents in body text", () => {
    const t = tokenizeLegal("Ciência, Tecnologia e Inovação");
    expect(t).toContain("ciencia");
    expect(t).toContain("tecnologia");
    expect(t).toContain("inovacao");
  });

  it("article suffix preserves letter (e.g. 219-A → art_219a)", () => {
    const t = tokenizeLegal("Art. 219-A da Constituição");
    expect(t).toContain("art_219a");
  });
});

describe("buildLegalSparseVector", () => {
  it("returns sparse with sorted indices", () => {
    const v = buildLegalSparseVector("Art. 5º, LIV — devido processo legal", {
      codigo: "CF",
      articleRef: "Art. 5º",
      incisoRef: "LIV",
      hierarchy: "Título II > Direitos e Garantias Fundamentais",
    });
    expect(v.indices.length).toBeGreaterThan(0);
    expect(v.indices.length).toBe(v.values.length);
    for (let i = 1; i < v.indices.length; i++) {
      expect(v.indices[i]!).toBeGreaterThan(v.indices[i - 1]!);
    }
    // Todos values positivos.
    for (const w of v.values) expect(w).toBeGreaterThan(0);
  });

  it("metadata boosts increase weight of canonical terms", () => {
    // Mesmo texto, com e sem metadata.
    const baseText = "ninguem sera privado da liberdade sem o devido processo legal";

    const noMeta = buildLegalSparseVector(baseText, {});
    const withMeta = buildLegalSparseVector(baseText, {
      articleRef: "Art. 5º",
      incisoRef: "LIV",
      codigo: "CF",
    });

    // Termos do metadata devem aparecer no sparse com metadata.
    const idxArt5 = stableSparseIndex(normalizeLegalToken("art_5"));
    const wWith = idxValue(withMeta, idxArt5);
    const wNo = idxValue(noMeta, idxArt5);
    expect(wWith).toBeGreaterThan(wNo);
  });

  it("is deterministic — same input → same output", () => {
    const a = buildLegalSparseVector("Art. 1º — A República Federativa do Brasil", {
      codigo: "CF",
      articleRef: "Art. 1º",
    });
    const b = buildLegalSparseVector("Art. 1º — A República Federativa do Brasil", {
      codigo: "CF",
      articleRef: "Art. 1º",
    });
    expect(a.indices).toEqual(b.indices);
    expect(a.values).toEqual(b.values);
  });

  it("handles empty input gracefully", () => {
    const v = buildLegalSparseVector("", {});
    expect(v.indices).toEqual([]);
    expect(v.values).toEqual([]);
  });
});

describe("buildLegalSparseQuery", () => {
  it("boosts intent.articleRefs and intent.urns", () => {
    const q = "responsabilidade objetiva";

    const noIntent = buildLegalSparseQuery(q);
    const withIntent = buildLegalSparseQuery(q, {
      urns: ["urn:lex:br:federal:lei:1990-09-11;8078"],
      articleRefs: ["Art. 14"],
      tribunals: ["STJ"],
    });

    // Token "art_14" entra com boost intent (5.0).
    const idxArt14 = stableSparseIndex("art_14");
    const wIntent = idxValue(withIntent, idxArt14);
    const wPlain = idxValue(noIntent, idxArt14);
    expect(wIntent).toBeGreaterThan(0);
    expect(wPlain).toBe(0); // não havia "art 14" no texto

    // Tribunal STJ.
    const idxStj = stableSparseIndex("stj");
    const wStj = idxValue(withIntent, idxStj);
    expect(wStj).toBeGreaterThan(0);
  });

  it("works without intent (text-only)", () => {
    const v = buildLegalSparseQuery("dignidade da pessoa humana");
    expect(v.indices.length).toBeGreaterThan(0);
    const idxDign = stableSparseIndex("dignidade");
    expect(idxValue(v, idxDign)).toBeGreaterThan(0);
  });
});

/** Ajuda para checar peso por índice numa sparse vector. Retorna 0 se ausente. */
function idxValue(v: { indices: number[]; values: number[] }, idx: number): number {
  const i = v.indices.indexOf(idx);
  if (i < 0) return 0;
  return v.values[i] ?? 0;
}
