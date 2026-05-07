import { describe, expect, it, vi } from "vitest";
import { NormKind } from "@prisma/client";
import { fixtureProvider, getFixtureNorms } from "./fixture";
import { lexmlProvider, parseSruResponse, stripHtml } from "./lexml";

describe("FixtureCorpusProvider", () => {
  it("lista todos os candidatos sem cursor", async () => {
    const p = fixtureProvider();
    const page = await p.list({});
    expect(page.candidates.length).toBe(getFixtureNorms().length);
    expect(page.nextCursor).toBeNull();
  });

  it("filtra por kind", async () => {
    const p = fixtureProvider();
    const page = await p.list({ kind: NormKind.SUMULA_VINCULANTE });
    expect(page.candidates.length).toBe(1);
    expect(page.candidates[0]!.kind).toBe(NormKind.SUMULA_VINCULANTE);
  });

  it("paginação por cursor", async () => {
    const p = fixtureProvider();
    const first = await p.list({ pageSize: 1 });
    expect(first.candidates.length).toBe(1);
    expect(first.nextCursor).not.toBeNull();
    const second = await p.list({ pageSize: 1, cursor: first.nextCursor });
    expect(second.candidates.length).toBe(1);
    expect(second.candidates[0]!.urn).not.toBe(first.candidates[0]!.urn);
  });

  it("fetch retorna payload do candidato existente", async () => {
    const p = fixtureProvider();
    const list = await p.list({});
    const payload = await p.fetch(list.candidates[0]!);
    expect(payload.rawText.length).toBeGreaterThan(50);
    expect(payload.candidate.urn).toBe(list.candidates[0]!.urn);
  });

  it("fetch falha em URN desconhecida", async () => {
    const p = fixtureProvider();
    await expect(
      p.fetch({
        urn: "urn:lex:br:federal:lei:1900-01-01;1",
        kind: NormKind.ORDINARY_LAW,
        title: "fake",
      }),
    ).rejects.toThrow(/não encontrada/);
  });
});

describe("LexmlCorpusProvider/parseSruResponse", () => {
  it("parseia records básicos", () => {
    const xml = `<?xml version="1.0"?>
<searchRetrieveResponse>
  <numberOfRecords>2</numberOfRecords>
  <records>
    <record>
      <urn>urn:lex:br:federal:lei:1990-09-11;8078</urn>
      <title>Lei nº 8.078, de 11 de setembro de 1990</title>
      <description>Dispõe sobre a proteção do consumidor.</description>
      <date>1990-09-11</date>
      <dcterms:URI>https://www.planalto.gov.br/ccivil_03/leis/l8078.htm</dcterms:URI>
    </record>
    <record>
      <urn>urn:lex:br:federal:lei:2002-01-10;10406</urn>
      <title>Código Civil</title>
      <date>2002-01-10</date>
    </record>
  </records>
</searchRetrieveResponse>`;
    const r = parseSruResponse(xml);
    expect(r.total).toBe(2);
    expect(r.records.length).toBe(2);
    expect(r.records[0]!.urn).toBe("urn:lex:br:federal:lei:1990-09-11;8078");
    expect(r.records[0]!.title).toContain("8.078");
    expect(r.records[0]!.publishedAt?.toISOString()).toContain("1990-09-11");
    expect(r.records[0]!.sourceUrl).toContain("planalto.gov.br");
  });

  it("ignora records sem urn", () => {
    const xml = `<root>
      <record><title>sem urn</title></record>
      <record><urn>urn:lex:br:federal:lei:1990-09-11;8078</urn><title>ok</title></record>
    </root>`;
    const r = parseSruResponse(xml);
    expect(r.records.length).toBe(1);
  });
});

describe("LexmlCorpusProvider", () => {
  it("list usa fetch injetado e mapeia candidates", async () => {
    const xml = `<root>
      <numberOfRecords>1</numberOfRecords>
      <records>
        <record>
          <urn>urn:lex:br:federal:lei:1990-09-11;8078</urn>
          <title>CDC</title>
        </record>
      </records>
    </root>`;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const p = lexmlProvider({ fetchImpl: fetchMock as unknown as typeof fetch });
    const page = await p.list({ kind: NormKind.ORDINARY_LAW });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(page.candidates.length).toBe(1);
    expect(page.candidates[0]!.urn).toBe("urn:lex:br:federal:lei:1990-09-11;8078");
    expect(page.candidates[0]!.kind).toBe(NormKind.ORDINARY_LAW);
  });

  it("list lança LexmlError em status >= 500", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const p = lexmlProvider({ fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(p.list({})).rejects.toMatchObject({ retryable: true, statusCode: 503 });
  });

  it("fetch sem sourceUrl lança erro não-retryable", async () => {
    const p = lexmlProvider({ fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(
      p.fetch({
        urn: "urn:lex:br:federal:lei:1990-09-11;8078",
        kind: NormKind.ORDINARY_LAW,
        title: "x",
      }),
    ).rejects.toMatchObject({ retryable: false });
  });
});

describe("stripHtml", () => {
  it("remove scripts/styles e tags, preservando texto", () => {
    const html = `<html><head><style>a{}</style></head><body>
      <h1>Lei</h1>
      <p>Art. 1º Texto.</p>
      <script>alert('x')</script>
    </body></html>`;
    const text = stripHtml(html);
    expect(text).toContain("Art. 1º Texto.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("<");
  });
});
