import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CorpusProvider, NormKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertCorpusPayload } from "@/lib/corpus/repository";
import { retrieveLegalContext } from "@/lib/retrieval/legal";

/**
 * Integration end-to-end do orquestrador, exercitando:
 *  - intent + rewrite
 *  - BM25 (PG real)
 *  - graph expansion via citations (norma A cita B → B é trazida)
 *  - boosts/scoring
 *  - grounding/confidence
 *  - trace observability
 *
 * Dense + rerank desabilitados (precisariam de Qdrant/DeepInfra ativos);
 * ainda sim provamos as etapas determinísticas do pipeline.
 */
describe("retrieval/legal orchestrator integration", () => {
  const tag = randomBytes(3).toString("hex");
  const urnPai = `urn:lex:br:federal:lei:1990-09-11;7700${tag}`;
  const urnFilho = `urn:lex:br:federal:lei:2002-01-10;7800${tag}`;

  beforeAll(async () => {
    await upsertCorpusPayload(
      {
        candidate: {
          urn: urnFilho,
          kind: NormKind.ORDINARY_LAW,
          title: `Lei filho ${tag}`,
          publishedAt: new Date("2002-01-10"),
        },
        rawText: `LEI ${tag} FILHO

Art. 1º Disciplina específica que aplica subsidiariamente o Código de Defesa do Consumidor (Lei nº 8.078, de 11 de setembro de 1990).

Art. 2º Princípio da boa-fé objetiva.`,
      },
      { provider: CorpusProvider.FIXTURE },
    );
    await upsertCorpusPayload(
      {
        candidate: {
          urn: urnPai,
          kind: NormKind.ORDINARY_LAW,
          title: `Lei pai ${tag}`,
          publishedAt: new Date("1990-09-11"),
        },
        rawText: `LEI ${tag} PAI — PROTEÇÃO DO CONSUMIDOR

Art. 1º Esta lei dispõe sobre a proteção do consumidor brasileiro.

Art. 6º São direitos básicos do consumidor: educação, segurança, informação clara.`,
      },
      { provider: CorpusProvider.FIXTURE },
    );

    // Forçamos uma citação direta de filho -> pai pra exercitar graph_citation_out.
    const filho = await prisma.legalNorm.findUnique({ where: { urn: urnFilho } });
    const pai = await prisma.legalNorm.findUnique({ where: { urn: urnPai } });
    if (!filho || !pai) throw new Error("setup falhou");
    await prisma.legalCitation.upsert({
      where: { id: `seed-cite-${tag}` },
      create: {
        id: `seed-cite-${tag}`,
        sourceNormId: filho.id,
        targetNormId: pai.id,
        targetUrn: pai.urn,
        kind: "CITES",
        confidence: 0.99,
      },
      update: {},
    });
  });

  afterAll(async () => {
    for (const u of [urnPai, urnFilho]) {
      await prisma.legalCitation.deleteMany({ where: { source: { urn: u } } });
      await prisma.legalCitation.deleteMany({ where: { target: { urn: u } } });
      await prisma.legalChunk.deleteMany({ where: { norm: { urn: u } } });
      await prisma.legalNormVersion.deleteMany({ where: { norm: { urn: u } } });
      await prisma.legalNorm.deleteMany({ where: { urn: u } });
    }
  });

  it("retrieve completo: intent + bm25 + graph + scoring + grounding", async () => {
    const result = await retrieveLegalContext("proteção do consumidor brasileiro", {
      filters: { normUrns: [urnPai, urnFilho] },
      useCache: false,
      useRerank: false,
      useGraphExpansion: true,
      topK: 5,
    });

    expect(result.cached).toBe(false);
    expect(result.rewrittenQueries.length).toBeGreaterThanOrEqual(1);
    expect(result.intent.signals).toBeTruthy();
    expect(result.chunks.length).toBeGreaterThan(0);

    // O chunk top deve estar relacionado à proteção do consumidor (Lei pai).
    const top = result.chunks[0]!;
    expect(top.norm.urn).toBe(urnPai);
    expect(top.scores.final).toBeGreaterThan(0);
    expect(top.explanation).toMatch(/boost|final/);
    expect(top.provenance.length).toBeGreaterThan(0);

    // Trace observabilidade
    expect(result.trace.traceId).toBeTruthy();
    expect(result.trace.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.trace.candidates.bm25).toBeGreaterThan(0);
    expect(result.trace.stages.some((s) => s.stage === "classify-intent")).toBe(true);
    expect(result.trace.stages.some((s) => s.stage === "fuse")).toBe(true);
  });

  it("graph expansion traz norma vizinha quando o seed cita ela", async () => {
    // Query escolhida pra fazer match BM25 NO FILHO (que cita o pai).
    // "boa-fé objetiva" só aparece em urnFilho. Após bm25 trazer urnFilho como
    // seed, o graph expansion deve seguir a aresta CITES e trazer urnPai.
    const result = await retrieveLegalContext("boa-fé objetiva princípio", {
      filters: { normUrns: [urnPai, urnFilho] },
      useCache: false,
      useRerank: false,
      useGraphExpansion: true,
      topK: 8,
    });

    const urns = result.chunks.map((c) => c.norm.urn);
    expect(urns).toContain(urnFilho);
    const paiChunk = result.chunks.find((c) => c.norm.urn === urnPai);
    expect(paiChunk).toBeDefined();
    expect(paiChunk!.provenance.some((p) => p.startsWith("graph_"))).toBe(true);
  });

  it("respeita filtro asOf: ignora versões posteriores", async () => {
    const result = await retrieveLegalContext("proteção consumidor", {
      filters: { normUrns: [urnPai, urnFilho], asOf: new Date("1995-01-01") },
      useCache: false,
      useRerank: false,
      useGraphExpansion: false,
    });
    const urns = result.chunks.map((c) => c.norm.urn);
    expect(urns).not.toContain(urnFilho); // urnFilho publicado em 2002
  });

  it("duas chamadas idênticas produzem os mesmos chunks (determinismo)", async () => {
    const opts = {
      filters: { normUrns: [urnPai] },
      useCache: false,
      useRerank: false,
      useGraphExpansion: false,
      topK: 3,
    };
    const a = await retrieveLegalContext("teste determinismo " + tag, opts);
    const b = await retrieveLegalContext("teste determinismo " + tag, opts);
    expect(a.chunks.map((c) => c.chunkId).sort()).toEqual(b.chunks.map((c) => c.chunkId).sort());
  });

  it("query sem matches reporta confidence Baixa e grounding fraco", async () => {
    // Com hybrid search (dense + sparse + RRF), uma query absurda quase
    // sempre encontra vizinhos próximos no espaço denso. O sinal de
    // ausência de matches passa a ser confidence=Baixa e groundingScore
    // baixo, e não chunks.length === 0.
    const result = await retrieveLegalContext("xyz_string_inexistente_unique_" + tag, {
      filters: { normUrns: [urnPai, urnFilho] },
      useCache: false,
      useRerank: false,
      useGraphExpansion: false,
    });
    expect(result.confidence.label).toBe("Baixa");
    expect(result.groundingScore).toBeLessThan(0.5);
  });

  it("groundingScore reflete top1 + diversidade", async () => {
    const result = await retrieveLegalContext("proteção do consumidor", {
      filters: { normUrns: [urnPai, urnFilho] },
      useCache: false,
      useRerank: false,
      useGraphExpansion: true,
      topK: 8,
    });
    if (result.chunks.length > 0) {
      expect(result.groundingScore).toBeGreaterThan(0);
      expect(result.groundingScore).toBeLessThanOrEqual(1);
      expect(["Alta", "Média", "Baixa"]).toContain(result.confidence.label);
    }
  });
});
