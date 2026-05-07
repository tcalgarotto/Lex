import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CorpusProvider, NormKind, NormStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fixtureProvider } from "@/lib/corpus/providers/fixture";
import {
  finishIngestionJob,
  readWatermark,
  resolvePendingCitationsTo,
  startIngestionJob,
  upsertCorpusPayload,
  writeWatermark,
} from "@/lib/corpus/repository";

/**
 * Integration: exercita o repositório do corpus contra Postgres real.
 * Não toca em Qdrant. Usa fixtures para evitar rede.
 */
describe("corpus repository integration", () => {
  const suffix = randomBytes(3).toString("hex");
  const testUrn = `urn:lex:br:federal:lei:1990-09-11;9999${suffix}`;
  const tag = `it-corpus-${suffix}`;

  beforeAll(async () => {
    // Garantir que partimos limpo dessa URN.
    await prisma.legalCitation.deleteMany({ where: { source: { urn: testUrn } } });
    await prisma.legalChunk.deleteMany({ where: { norm: { urn: testUrn } } });
    await prisma.legalNormVersion.deleteMany({ where: { norm: { urn: testUrn } } });
    await prisma.legalNorm.deleteMany({ where: { urn: testUrn } });
  });

  afterAll(async () => {
    await prisma.legalCitation.deleteMany({ where: { source: { urn: testUrn } } });
    await prisma.legalChunk.deleteMany({ where: { norm: { urn: testUrn } } });
    await prisma.legalNormVersion.deleteMany({ where: { norm: { urn: testUrn } } });
    await prisma.legalNorm.deleteMany({ where: { urn: testUrn } });
    await prisma.ingestionJob.deleteMany({
      where: { metadataJson: { equals: { tag } as object } },
    });
    await prisma.ingestionWatermark.deleteMany({
      where: { metadataJson: { equals: { tag } as object } },
    });
  });

  it("cria norma + versão + chunks + citações", async () => {
    const result = await upsertCorpusPayload(
      {
        candidate: {
          urn: testUrn,
          kind: NormKind.ORDINARY_LAW,
          title: "Teste de integração — norma fixture",
          identifier: "Lei nº 9999/1990",
          publishedAt: new Date("1990-09-11T00:00:00Z"),
          tags: [tag],
        },
        rawText: `LEI Nº 9999/1990 — TESTE

Art. 1º A presente lei está em consonância com o CDC (Lei nº 8.078/1990) e com a CF/88.

Art. 2º Aplica-se subsidiariamente o Código Civil.`,
      },
      { provider: CorpusProvider.FIXTURE },
    );

    expect(result.created).toBe(true);
    expect(result.versioned).toBe(true);
    expect(result.chunksUpserted).toBeGreaterThan(0);
    expect(result.citationsUpserted).toBeGreaterThanOrEqual(2);

    const norm = await prisma.legalNorm.findUnique({ where: { urn: testUrn } });
    expect(norm).not.toBeNull();
    expect(norm!.kind).toBe(NormKind.ORDINARY_LAW);
    expect(norm!.status).toBe(NormStatus.ACTIVE);
    expect(norm!.contentHash).toBe(result.contentHash);

    const versions = await prisma.legalNormVersion.findMany({
      where: { normId: norm!.id },
    });
    expect(versions.length).toBe(1);

    const chunks = await prisma.legalChunk.findMany({
      where: { normId: norm!.id },
      orderBy: { ordinal: "asc" },
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.contentHash.length === 64)).toBe(true);
    expect(chunks.some((c) => c.articleRef === "Art. 1º")).toBe(true);

    const cites = await prisma.legalCitation.findMany({
      where: { sourceNormId: norm!.id },
    });
    expect(cites.length).toBeGreaterThanOrEqual(2);
    const targets = cites.map((c) => c.targetUrn);
    expect(targets).toContain("urn:lex:br:federal:lei:1990-09-11;8078");
    expect(targets).toContain("urn:lex:br:federal:constituicao:1988-10-05;1988");
  });

  it("é idempotente: repetir o mesmo payload é no-op", async () => {
    const before = await prisma.legalChunk.count({
      where: { norm: { urn: testUrn } },
    });
    const result = await upsertCorpusPayload(
      {
        candidate: {
          urn: testUrn,
          kind: NormKind.ORDINARY_LAW,
          title: "Teste de integração — norma fixture",
          publishedAt: new Date("1990-09-11T00:00:00Z"),
        },
        rawText: `LEI Nº 9999/1990 — TESTE

Art. 1º A presente lei está em consonância com o CDC (Lei nº 8.078/1990) e com a CF/88.

Art. 2º Aplica-se subsidiariamente o Código Civil.`,
      },
      { provider: CorpusProvider.FIXTURE },
    );

    expect(result.versioned).toBe(false);
    expect(result.chunksUpserted).toBe(0);

    const after = await prisma.legalChunk.count({
      where: { norm: { urn: testUrn } },
    });
    expect(after).toBe(before);
  });

  it("conteúdo modificado cria nova versão e regera chunks", async () => {
    const result = await upsertCorpusPayload(
      {
        candidate: {
          urn: testUrn,
          kind: NormKind.ORDINARY_LAW,
          title: "Teste de integração — norma fixture v2",
          publishedAt: new Date("1990-09-11T00:00:00Z"),
          effectiveAt: new Date("2024-01-01T00:00:00Z"),
        },
        rawText: `LEI Nº 9999/1990 — TESTE (REVISÃO 2024)

Art. 1º Esta versão modificada agora cita também o CPC (Lei nº 13.105/2015).

Art. 2º Cláusula nova adicionada.`,
      },
      { provider: CorpusProvider.FIXTURE },
    );

    expect(result.versioned).toBe(true);
    expect(result.chunksUpserted).toBeGreaterThan(0);

    const norm = await prisma.legalNorm.findUnique({ where: { urn: testUrn } });
    const versions = await prisma.legalNormVersion.findMany({
      where: { normId: norm!.id },
      orderBy: { validFrom: "asc" },
    });
    expect(versions.length).toBe(2);
    expect(versions[0]!.validTo).not.toBeNull();
    expect(versions[1]!.validTo).toBeNull();
  });

  it("watermark e jobs persistem", async () => {
    const before = await readWatermark(CorpusProvider.FIXTURE, NormKind.OTHER);
    await writeWatermark({
      provider: CorpusProvider.FIXTURE,
      kind: NormKind.OTHER,
      cursor: "cursor-1",
      itemsTotal: 42,
      metadata: { tag },
    });
    const after = await readWatermark(CorpusProvider.FIXTURE, NormKind.OTHER);
    expect(after).toBe("cursor-1");
    expect(after).not.toBe(before);

    const jobId = await startIngestionJob({ provider: CorpusProvider.FIXTURE });
    await finishIngestionJob(jobId, {
      status: "COMPLETED",
      itemsProcessed: 1,
    });
    const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
    expect(job?.finishedAt).not.toBeNull();
  });

  it("fixture provider full flow: list -> fetch -> upsert", async () => {
    const provider = fixtureProvider();
    const page = await provider.list({});
    expect(page.candidates.length).toBeGreaterThan(0);
    const cdc = page.candidates.find((c) => c.urn.endsWith(";8078"));
    expect(cdc).toBeDefined();

    // Limpa antes de subir o CDC fixture (idempotência cruzada com outros testes)
    await prisma.legalCitation.deleteMany({ where: { source: { urn: cdc!.urn } } });
    await prisma.legalChunk.deleteMany({ where: { norm: { urn: cdc!.urn } } });
    await prisma.legalNormVersion.deleteMany({ where: { norm: { urn: cdc!.urn } } });
    await prisma.legalNorm.deleteMany({ where: { urn: cdc!.urn } });

    const payload = await provider.fetch(cdc!);
    const r = await upsertCorpusPayload(payload, { provider: CorpusProvider.FIXTURE });
    expect(r.created).toBe(true);
    expect(r.chunksUpserted).toBeGreaterThan(0);

    const resolved = await resolvePendingCitationsTo(cdc!.urn);
    // Pode ser 0 ou mais — depende de outras normas terem citado o CDC.
    expect(resolved).toBeGreaterThanOrEqual(0);

    // Cleanup do CDC pra não vazar pra outros testes
    await prisma.legalCitation.deleteMany({ where: { source: { urn: cdc!.urn } } });
    await prisma.legalChunk.deleteMany({ where: { norm: { urn: cdc!.urn } } });
    await prisma.legalNormVersion.deleteMany({ where: { norm: { urn: cdc!.urn } } });
    await prisma.legalNorm.deleteMany({ where: { urn: cdc!.urn } });
  });
});
