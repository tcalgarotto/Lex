import { describe, it, expect, vi } from "vitest";
import { SenadoCorpusProvider } from "./senado";

function mockFetch(jsonByUrl: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const key = Object.keys(jsonByUrl).find((k) => url.startsWith(k));
    if (!key) {
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(jsonByUrl[key]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("Senado provider", () => {
  it("list() interpreta lista de Materia (array ou single)", async () => {
    const fetchImpl = mockFetch({
      "https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista": {
        PesquisaBasicaMateria: {
          Materias: {
            Materia: [
              {
                CodigoMateria: "1001",
                SiglaSubtipoMateria: "PLS",
                NumeroMateria: "10",
                AnoMateria: "2026",
                EmentaMateria: "Sobre algo importante",
                DataApresentacao: "2026-01-15",
              },
              {
                CodigoMateria: "1002",
                SiglaSubtipoMateria: "PEC",
                NumeroMateria: "5",
                AnoMateria: "2026",
              },
            ],
          },
        },
      },
    });
    const provider = new SenadoCorpusProvider({
      fetchImpl,
      ratePerMinute: 1000,
    });
    const page = await provider.list({ pageSize: 50 });
    expect(page.candidates.length).toBe(2);
    expect(page.candidates[0]!.tribunal).toBe("SENADO");
    expect(page.candidates[0]!.sourceExternalId).toBe("senado-1001");
    expect(page.candidates[0]!.identifier).toContain("PLS 10/2026");
    expect(page.nextCursor).toBeTruthy();
  });

  it("list() lida com Materia single (não-array)", async () => {
    const fetchImpl = mockFetch({
      "https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista": {
        PesquisaBasicaMateria: {
          Materias: {
            Materia: {
              CodigoMateria: "999",
              SiglaSubtipoMateria: "PL",
              NumeroMateria: "1",
              AnoMateria: "2026",
            },
          },
        },
      },
    });
    const provider = new SenadoCorpusProvider({
      fetchImpl,
      ratePerMinute: 1000,
    });
    const page = await provider.list({ pageSize: 50 });
    expect(page.candidates.length).toBe(1);
    expect(page.candidates[0]!.sourceExternalId).toBe("senado-999");
  });

  it("list() ignora itens sem código/numero/ano", async () => {
    const fetchImpl = mockFetch({
      "https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista": {
        PesquisaBasicaMateria: {
          Materias: { Materia: [{ CodigoMateria: "1" /* faltam outros */ }] },
        },
      },
    });
    const provider = new SenadoCorpusProvider({
      fetchImpl,
      ratePerMinute: 1000,
    });
    const page = await provider.list({ pageSize: 50 });
    expect(page.candidates.length).toBe(0);
  });

  it("fetch() resolve detalhe e monta rawText", async () => {
    const fetchImpl = mockFetch({
      "https://legis.senado.leg.br/dadosabertos/materia/1001": {
        DetalheMateria: {
          Materia: {
            IdentificacaoMateria: {
              SiglaSubtipoMateria: "PLS",
              NumeroMateria: "10",
              AnoMateria: "2026",
            },
            DadosBasicosMateria: {
              EmentaMateria: "Sobre algo importante",
              ExplicacaoEmentaMateria: "Explica o porquê",
            },
          },
        },
      },
    });
    const provider = new SenadoCorpusProvider({
      fetchImpl,
      ratePerMinute: 1000,
    });
    const payload = await provider.fetch({
      urn: "urn:lex:br:senado.federal:materia.pls:2026-01-15;10",
      kind: "OTHER" as never,
      title: "PLS 10/2026",
      sourceExternalId: "senado-1001",
    });
    expect(payload.rawText).toContain("PLS 10/2026");
    expect(payload.rawText).toContain("Sobre algo importante");
    expect(payload.rawText).toContain("Explica o porquê");
    expect(payload.metadata).toMatchObject({ source: "senado", codigo: "1001" });
  });
});
