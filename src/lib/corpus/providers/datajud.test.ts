import { describe, expect, it, vi } from "vitest";
import { NormKind } from "@prisma/client";
import {
  DatajudCorpusProvider,
  buildDatajudListQuery,
  extractRawTextFromDatajudHit,
  mapDatajudHitToCandidate,
} from "./datajud";

describe("buildDatajudListQuery", () => {
  it("inclui sort por @timestamp e _id", () => {
    const q = buildDatajudListQuery({ size: 10 }) as Record<string, unknown>;
    expect(q["size"]).toBe(10);
    expect(q["sort"]).toEqual([{ "@timestamp": { order: "desc" } }, { _id: "asc" }]);
    expect(q["query"]).toEqual({ match_all: {} });
  });

  it("propaga search_after quando há cursor JSON válido", () => {
    const q = buildDatajudListQuery({ size: 5, cursor: "[1700000000,\"abc\"]" }) as Record<string, unknown>;
    expect(q["search_after"]).toEqual([1700000000, "abc"]);
  });

  it("ignora cursor inválido sem quebrar", () => {
    const q = buildDatajudListQuery({ size: 5, cursor: "lixo" }) as Record<string, unknown>;
    expect(q["search_after"]).toBeUndefined();
  });
});

describe("mapDatajudHitToCandidate", () => {
  it("constrói URN canônica a partir do tribunal + número de processo", () => {
    const c = mapDatajudHitToCandidate(
      {
        _id: "abc-123",
        _source: {
          numeroProcesso: "0000123-45.2024.8.26.0100",
          tribunal: "TJSP",
          dataAjuizamento: "2024-04-01T00:00:00Z",
        },
      },
      "api_publica_tjsp",
    );
    expect(c?.urn).toMatch(/^urn:lex:br:tjsp:processo:0{0,2}/);
    expect(c?.tribunal).toBe("TJSP");
    expect(c?.kind).toBe(NormKind.JURISPRUDENCE_OTHER);
    expect(c?.publishedAt?.toISOString()).toBe("2024-04-01T00:00:00.000Z");
  });

  it("retorna null quando não tem numeroProcesso", () => {
    expect(mapDatajudHitToCandidate({ _source: {} }, "alias")).toBeNull();
  });
});

describe("extractRawTextFromDatajudHit", () => {
  it("compila classe + assuntos + movimentos em texto plano", () => {
    const txt = extractRawTextFromDatajudHit({
      _source: {
        classe: { codigo: 1116 },
        assuntos: [{ codigo: 7691 }],
        movimentos: [
          { nome: "Distribuição", descricao: "..." },
          { nome: "Conclusão", descricao: "..." },
        ],
      },
    });
    expect(txt).toContain("Classe");
    expect(txt).toContain("Assuntos");
    expect(txt).toMatch(/Distribuição/);
  });
});

describe("DatajudCorpusProvider", () => {
  it("lança erro quando API key ausente", async () => {
    const p = new DatajudCorpusProvider({ alias: "api_publica_tjsp" });
    await expect(p.list({ pageSize: 1 })).rejects.toThrow(/API_KEY/);
  });

  it("lista hits e mapeia pra candidates", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _id: "x1",
                  _source: { numeroProcesso: "1", tribunal: "TJSP" },
                  sort: [1, "x1"],
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const p = new DatajudCorpusProvider({
      alias: "api_publica_tjsp",
      apiKey: "test",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const page = await p.list({ pageSize: 5 });
    expect(page.candidates.length).toBe(1);
    expect(page.candidates[0]!.tribunal).toBe("TJSP");
    expect(page.totalEstimated).toBe(1);
    expect(page.nextCursor).toBe("[1,\"x1\"]");
  });
});
