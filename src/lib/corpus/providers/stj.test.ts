import { describe, expect, it, vi } from "vitest";
import { NormKind } from "@prisma/client";
import { StjCorpusProvider, defaultStjExtractor } from "./stj";

describe("defaultStjExtractor", () => {
  it("retira tags e devolve ementa + rawText", () => {
    const html = "<html><body><p>Súmula 511 - É possível...</p></body></html>";
    const out = defaultStjExtractor(html);
    expect(out?.rawText).toContain("Súmula 511");
    expect(out?.ementa?.length).toBeLessThanOrEqual(600);
  });

  it("html vazio devolve null", () => {
    expect(defaultStjExtractor("")).toBeNull();
  });
});

describe("StjCorpusProvider", () => {
  it("list devolve URN canônica e identifier", async () => {
    const fetchMock = vi.fn();
    const p = new StjCorpusProvider({ fetchImpl: fetchMock as unknown as typeof fetch, maxIds: 2 });
    const page = await p.list({ kind: NormKind.SUMULA_STJ, pageSize: 2 });
    expect(page.candidates[0]!.urn).toMatch(/superior\.tribunal\.justica:sumula:1/);
    expect(page.candidates[0]!.title).toBe("Súmula STJ 1");
    expect(page.candidates[0]!.kind).toBe(NormKind.SUMULA_STJ);
  });

  it("list ignora kind não suportado (ex.: jurisprudência)", async () => {
    const p = new StjCorpusProvider({ maxIds: 5 });
    const page = await p.list({ kind: NormKind.JURISPRUDENCE_STJ });
    expect(page.candidates).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("respeita cursor de paginação", async () => {
    const p = new StjCorpusProvider({ maxIds: 50 });
    const page = await p.list({ kind: NormKind.SUMULA_STJ, cursor: "10", pageSize: 3 });
    expect(page.candidates[0]!.title).toBe("Súmula STJ 10");
    expect(page.candidates[2]!.title).toBe("Súmula STJ 12");
    expect(page.nextCursor).toBe("13");
  });

  it("fetch usa extractor injetado", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<p>conteúdo</p>", { status: 200 }),
    );
    const extractor = vi.fn(() => ({ rawText: "TEXTO PARSEADO" }));
    const p = new StjCorpusProvider({
      fetchImpl: fetchMock as unknown as typeof fetch,
      extractor,
    });
    const payload = await p.fetch({
      urn: "urn:lex:br:superior.tribunal.justica:sumula:511",
      kind: NormKind.SUMULA_STJ,
      title: "Súmula 511",
      identifier: "Súmula STJ 511",
    });
    expect(extractor).toHaveBeenCalled();
    expect(payload.rawText).toBe("TEXTO PARSEADO");
  });
});
