import { describe, expect, it, vi } from "vitest";
import { NormKind } from "@prisma/client";
import { StfCorpusProvider, extractTextFromStfHtml } from "./stf";

const sumulaHtml = `<!DOCTYPE html>
<html>
  <head><title>Súmula Vinculante 14</title></head>
  <body>
    <div class="verbete">
      É direito do defensor, no interesse do representado, ter acesso amplo
      aos elementos de prova que, já documentados em procedimento investigatório
      realizado por órgão com competência de polícia judiciária, digam respeito
      ao exercício do direito de defesa.
    </div>
  </body>
</html>`;

describe("extractTextFromStfHtml", () => {
  it("extrai texto da div.verbete e remove tags", () => {
    const txt = extractTextFromStfHtml(sumulaHtml);
    expect(txt).toContain("direito do defensor");
    expect(txt).not.toMatch(/<\/?div>/);
    expect(txt).not.toMatch(/<style/);
  });

  it("decodifica entidades HTML básicas", () => {
    const html = "<div class=\"verbete\">A&nbsp;B&amp;C&lt;D&gt;E&quot;F</div>";
    expect(extractTextFromStfHtml(html)).toBe("A B&C<D>E\"F");
  });

  it("fallback: sem div.verbete usa o body inteiro", () => {
    const html = "<body><p>Texto puro</p></body>";
    expect(extractTextFromStfHtml(html)).toContain("Texto puro");
  });

  it("html vazio retorna string vazia", () => {
    expect(extractTextFromStfHtml("")).toBe("");
  });
});

describe("StfCorpusProvider", () => {
  it("list devolve metadata com URN canônica de Súmula Vinculante", async () => {
    const fetchMock = vi.fn(async () => new Response(sumulaHtml, { status: 200 }));
    const p = new StfCorpusProvider({ fetchImpl: fetchMock as unknown as typeof fetch, maxIds: 5 });
    const page = await p.list({ kind: NormKind.SUMULA_VINCULANTE, pageSize: 2 });
    expect(page.candidates.length).toBe(2);
    expect(page.candidates[0]!.urn).toMatch(/^urn:lex:br:supremo\.tribunal\.federal:sumula\.vinculante:/);
    expect(page.candidates[0]!.kind).toBe(NormKind.SUMULA_VINCULANTE);
    expect(page.candidates[0]!.title).toBe("Súmula Vinculante 1");
    expect(page.nextCursor).toBe("3");
  });

  it("list devolve metadata de Súmula STF (não vinculante)", async () => {
    const fetchMock = vi.fn(async () => new Response(sumulaHtml, { status: 200 }));
    const p = new StfCorpusProvider({ fetchImpl: fetchMock as unknown as typeof fetch, maxIds: 1 });
    const page = await p.list({ kind: NormKind.SUMULA_STF, pageSize: 1 });
    expect(page.candidates[0]!.urn).toContain(":sumula:");
    expect(page.candidates[0]!.kind).toBe(NormKind.SUMULA_STF);
  });

  it("fetch devolve rawText extraído do HTML real", async () => {
    const fetchMock = vi.fn(async () => new Response(sumulaHtml, { status: 200 }));
    const p = new StfCorpusProvider({ fetchImpl: fetchMock as unknown as typeof fetch });
    const candidate = {
      urn: "urn:lex:br:supremo.tribunal.federal:sumula.vinculante:14",
      kind: NormKind.SUMULA_VINCULANTE,
      title: "SV 14",
      identifier: "Súmula Vinculante 14",
    };
    const payload = await p.fetch(candidate);
    expect(payload.rawText).toContain("direito do defensor");
  });

  it("fetch lança StfError quando identifier não tem número", async () => {
    const p = new StfCorpusProvider({ fetchImpl: (async () => new Response("", { status: 200 })) as never });
    await expect(
      p.fetch({
        urn: "urn:test",
        kind: NormKind.SUMULA_VINCULANTE,
        title: "X",
      }),
    ).rejects.toThrow(/identifier sem número/);
  });

  it("HTTP 404 numa súmula durante list não derruba a varredura", async () => {
    let count = 0;
    const fetchMock = vi.fn(async () => {
      count++;
      return count === 2 ? new Response("", { status: 404 }) : new Response(sumulaHtml, { status: 200 });
    });
    const p = new StfCorpusProvider({ fetchImpl: fetchMock as unknown as typeof fetch, maxIds: 3 });
    const page = await p.list({ kind: NormKind.SUMULA_VINCULANTE, pageSize: 3 });
    expect(page.candidates.length).toBe(2);
  });
});
