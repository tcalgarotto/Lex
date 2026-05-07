import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CorpusProvider, NormKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertCorpusPayload } from "@/lib/corpus/repository";
import { searchBm25 } from "@/lib/retrieval/legal/bm25";

/**
 * Integration: BM25 contra Postgres real (FTS + ts_rank_cd).
 * Usa URNs efêmeras com timestamp pra não colidir com fixtures globais.
 */
describe("retrieval/legal/bm25 integration", () => {
  const tag = randomBytes(3).toString("hex");
  const urn1 = `urn:lex:br:federal:lei:1990-09-11;7777${tag}`;
  const urn2 = `urn:lex:br:federal:lei:2002-01-10;8888${tag}`;

  beforeAll(async () => {
    await Promise.all([
      upsertCorpusPayload(
        {
          candidate: {
            urn: urn1,
            kind: NormKind.ORDINARY_LAW,
            title: `BM25 Test Lei ${tag}`,
            publishedAt: new Date("1990-09-11"),
            tags: [`bm25-${tag}`],
          },
          rawText: `LEI Nº 7777/1990 — TESTE BM25 ${tag}

Art. 1º A presente lei trata da proteção do consumidor, com foco em direito de arrependimento e cláusula abusiva.

Art. 2º A defesa do consumidor é princípio constitucional, protegido pela Constituição Federal.`,
        },
        { provider: CorpusProvider.FIXTURE },
      ),
      upsertCorpusPayload(
        {
          candidate: {
            urn: urn2,
            kind: NormKind.ORDINARY_LAW,
            title: `BM25 Test CC ${tag}`,
            publishedAt: new Date("2002-01-10"),
            tags: [`bm25-${tag}`],
          },
          rawText: `LEI Nº 8888/2002 — CÓDIGO CIVIL TESTE ${tag}

Art. 1º Toda pessoa é capaz de direitos e deveres na ordem civil.

Art. 200. Não corre prescrição quando se tratar de ação de filiação.`,
        },
        { provider: CorpusProvider.FIXTURE },
      ),
    ]);
  });

  afterAll(async () => {
    for (const u of [urn1, urn2]) {
      await prisma.legalCitation.deleteMany({ where: { source: { urn: u } } });
      await prisma.legalChunk.deleteMany({ where: { norm: { urn: u } } });
      await prisma.legalNormVersion.deleteMany({ where: { norm: { urn: u } } });
      await prisma.legalNorm.deleteMany({ where: { urn: u } });
    }
  });

  it("BM25 ranqueia 'consumidor' acima do código civil", async () => {
    const results = await searchBm25({
      query: "proteção do consumidor cláusula abusiva",
      limit: 10,
      filters: { normUrns: [urn1, urn2] },
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.chunk.norm.urn).toBe(urn1);
    expect(results[0]!.rawScore).toBeGreaterThan(0);
  });

  it("BM25 com filter por kind reduz universo", async () => {
    const all = await searchBm25({
      query: "Art. 1",
      limit: 10,
      filters: { normUrns: [urn1, urn2] },
    });
    const byKind = await searchBm25({
      query: "Art. 1",
      limit: 10,
      filters: { normUrns: [urn1, urn2], kinds: [NormKind.ORDINARY_LAW] },
    });
    expect(byKind.length).toBeLessThanOrEqual(all.length);
    expect(byKind.every((r) => r.chunk.norm.kind === NormKind.ORDINARY_LAW)).toBe(true);
  });

  it("BM25 com asOf encontra apenas versões válidas", async () => {
    const results = await searchBm25({
      query: "consumidor proteção",
      limit: 10,
      filters: { normUrns: [urn1, urn2], asOf: new Date("2020-01-01") },
    });
    expect(results.every((r) => r.chunk.validFrom <= new Date("2020-01-01"))).toBe(true);
  });

  it("BM25 com filter inexistente retorna vazio", async () => {
    const results = await searchBm25({
      query: "consumidor",
      limit: 10,
      filters: { normUrns: ["urn:lex:br:federal:lei:1900-01-01;1"] },
    });
    expect(results).toEqual([]);
  });

  it("BM25 com query vazia retorna vazio", async () => {
    expect(await searchBm25({ query: "", limit: 10 })).toEqual([]);
    expect(await searchBm25({ query: "   ", limit: 10 })).toEqual([]);
  });

  it("articleRef filter encontra apenas chunks do artigo certo", async () => {
    // Descobre o articleRef real produzido pelo chunker (varia entre "Art. 200"
    // e "Art. 200º" dependendo da normalização aplicada no texto bruto).
    const sample = await prisma.legalChunk.findMany({
      where: { norm: { urn: urn2 }, articleRef: { not: null } },
      select: { articleRef: true },
    });
    const refs = Array.from(new Set(sample.map((s) => s.articleRef!)));
    expect(refs.length).toBeGreaterThan(0);

    const results = await searchBm25({
      query: "prescrição filiação",
      limit: 10,
      filters: { normUrns: [urn2], articleRefs: refs },
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => refs.includes(r.chunk.articleRef!))).toBe(true);
  });
});
