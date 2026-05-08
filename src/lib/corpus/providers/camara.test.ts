import { describe, it, expect, vi } from "vitest";
import { CamaraCorpusProvider } from "./camara";

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

describe("Camara provider", () => {
  it("list() devolve candidates a partir de /proposicoes", async () => {
    const fetchImpl = mockFetch({
      "https://dadosabertos.camara.leg.br/api/v2/proposicoes": {
        dados: [
          {
            id: 12345,
            uri: "https://...",
            siglaTipo: "PL",
            numero: 100,
            ano: 2026,
            ementa: "Dispõe sobre testes",
            dataApresentacao: "2026-02-10T00:00:00",
          },
          {
            id: 12346,
            uri: "https://...",
            siglaTipo: "PEC",
            numero: 7,
            ano: 2026,
          },
        ],
        links: [{ rel: "next", href: "?pagina=2" }],
      },
    });
    const provider = new CamaraCorpusProvider({
      fetchImpl,
      ratePerMinute: 1000,
    });
    const page = await provider.list({ pageSize: 50 });
    expect(page.candidates.length).toBe(2);
    expect(page.candidates[0]!.tribunal).toBe("CAMARA");
    expect(page.candidates[0]!.title).toBe("PL 100/2026");
    expect(page.candidates[0]!.sourceExternalId).toBe("camara-12345");
    expect(page.candidates[0]!.sourceUrl).toContain("12345");
    expect(page.nextCursor).toBe("2");
  });

  it("fetch() resolve detalhe e monta rawText", async () => {
    const fetchImpl = mockFetch({
      "https://dadosabertos.camara.leg.br/api/v2/proposicoes/12345": {
        dados: {
          id: 12345,
          uri: "https://...",
          siglaTipo: "PL",
          numero: 100,
          ano: 2026,
          ementa: "Dispõe sobre testes",
          ementaDetalhada: "Detalha a ementa",
          keywords: "teste, jurídico",
          statusProposicao: {
            descricaoTramitacao: "Aguardando designação de relator",
            descricaoSituacao: "Aguardando Despacho",
          },
        },
      },
    });
    const provider = new CamaraCorpusProvider({
      fetchImpl,
      ratePerMinute: 1000,
    });
    const payload = await provider.fetch({
      urn: "urn:lex:br:camara.deputados:proposicao.pl:2026-02-10;100",
      kind: "OTHER" as never,
      title: "PL 100/2026",
      sourceExternalId: "camara-12345",
    });
    expect(payload.rawText).toContain("PL 100/2026");
    expect(payload.rawText).toContain("Ementa: Dispõe sobre testes");
    expect(payload.rawText).toContain("Tramitação: Aguardando designação de relator");
    expect(payload.metadata).toMatchObject({ source: "camara", camaraId: 12345 });
  });
});
