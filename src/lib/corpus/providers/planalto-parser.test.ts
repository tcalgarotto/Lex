import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodePlanaltoBuffer,
  parsePlanaltoLawHtml,
} from "./planalto-parser";

const FIXTURE_PATH = resolve(__dirname, "../../../../tests/fixtures/planalto/lmp-snippet.html");
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, "utf-8");

describe("parsePlanaltoLawHtml — Lei Maria da Penha (snippet)", () => {
  const parsed = parsePlanaltoLawHtml(FIXTURE_HTML);

  it("extrai pelo menos 5 artigos do snippet", () => {
    expect(parsed.articles.length).toBeGreaterThanOrEqual(5);
  });

  it("cada artigo tem ref no formato 'Art. Nº'", () => {
    for (const a of parsed.articles) {
      expect(a.ref).toMatch(/^Art\. \d+(?:[º°ªo](?:-[A-Z])?|-[A-Z])$/);
    }
  });

  it("artigos têm number canônico (string)", () => {
    expect(parsed.articles[0]?.number).toBe("1");
    expect(parsed.articles[0]?.numberInt).toBe(1);
  });

  it("Art. 1º contém referência ao § 8º do art. 226 da Constituição", () => {
    const a1 = parsed.articles.find((a) => a.number === "1");
    expect(a1).toBeDefined();
    expect(a1!.text).toMatch(/§\s*8º\s+do\s+art\.\s*226/i);
    expect(a1!.text).toMatch(/Constituição/);
  });

  it("Art. 3º tem dois parágrafos (§ 1º e § 2º)", () => {
    const a3 = parsed.articles.find((a) => a.number === "3");
    expect(a3).toBeDefined();
    expect(a3!.paragraphs.length).toBeGreaterThanOrEqual(2);
  });

  it("texto não é cortado no meio (último char da última frase é pontuação ou letra)", () => {
    for (const a of parsed.articles) {
      const last = a.text.trim().slice(-1);
      expect([".", ":", "!", "?", "º", ")", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]).toContain(last);
    }
  });

  it("nenhum artigo tem texto vazio", () => {
    for (const a of parsed.articles) {
      expect(a.text.length).toBeGreaterThan(20);
    }
  });

  it("nenhum artigo aparece duplicado (sequence canônica)", () => {
    const numbers = parsed.articles.map((a) => a.number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });

  it("title da lei é detectado", () => {
    expect(parsed.title).toMatch(/Lei n[º°o]?\s*11\.?340/i);
  });

  it("stats consistentes", () => {
    expect(parsed.stats.articlesTotal).toBe(parsed.articles.length);
    expect(parsed.stats.bytes).toBeGreaterThan(1000);
    expect(parsed.stats.paragraphsTotal).toBeGreaterThanOrEqual(0);
  });
});

describe("parsePlanaltoLawHtml — robustez", () => {
  it("retorna stats vazios quando HTML não tem artigos", () => {
    const parsed = parsePlanaltoLawHtml(
      "<html><body><p>Texto qualquer</p></body></html>",
    );
    expect(parsed.articles).toEqual([]);
    expect(parsed.stats.articlesTotal).toBe(0);
  });

  it("não inventa artigos a partir de texto comum", () => {
    const parsed = parsePlanaltoLawHtml(
      "<html><body><p>O artigo 1 da CF dispõe que…</p></body></html>",
    );
    expect(parsed.articles.length).toBe(0);
  });

  it("lida com HTML aninhado em <font>/<a>/<sup>", () => {
    const html = `
      <html><body>
        <p><a name="art1"></a><font face="Arial">
          Art. 1º <sup>1</sup> Esta é uma lei de teste com <a href="x">link</a> dentro.
        </font></p>
        <p><a name="art2"></a><font>Art. 2º Outro artigo.</font></p>
      </body></html>`;
    const parsed = parsePlanaltoLawHtml(html);
    expect(parsed.articles.length).toBe(2);
    expect(parsed.articles[0]?.text).toMatch(/lei de teste/);
    expect(parsed.articles[0]?.text).not.toMatch(/<a /);
  });

  it("captura artigos com ponto de milhar (Art. 1.000, Art. 2.046-A)", () => {
    const html = `
      <html><body>
        <p><a name="art999"></a>Art. 999. Art. 999 simples.</p>
        <p><a name="art1000"></a>Art. 1.000. A sociedade simples...</p>
        <p><a name="art1196"></a>Art. 1.196. Considera-se possuidor...</p>
        <p><a name="art2046"></a>Art. 2.046. Vigora desde 2003.</p>
        <p><a name="art2046a"></a>Art. 2.046-A. Disposição transitória.</p>
      </body></html>`;
    const parsed = parsePlanaltoLawHtml(html);
    const numbers = parsed.articles.map((a) => a.number);
    expect(numbers).toContain("999");
    expect(numbers).toContain("1000");
    expect(numbers).toContain("1196");
    expect(numbers).toContain("2046");
    expect(numbers).toContain("2046-A");
  });

  it("extrai sufixos -A/-B/-C corretamente quando aparecem", () => {
    const html = `
      <html><body>
        <p><a name="art12"></a>Art. 12. Texto principal do artigo doze.</p>
        <p><a name="art12a"></a>Art. 12-A. Texto do artigo doze-A introduzido por lei posterior.</p>
        <p><a name="art12b"></a>Art. 12-B. Texto do artigo doze-B.</p>
      </body></html>`;
    const parsed = parsePlanaltoLawHtml(html);
    const numbers = parsed.articles.map((a) => a.number);
    expect(numbers).toContain("12");
    expect(numbers).toContain("12-A");
    expect(numbers).toContain("12-B");
    expect(parsed.articles.find((a) => a.number === "12-A")!.suffix).toBe("A");
  });

  it("não confunde inciso V com sufixo -V", () => {
    const html = `
      <html><body>
        <p><a name="art11"></a>Art. 11. Caput.</p>
        <p><a name="art11i"></a>I - inciso 1.</p>
        <p><a name="art11ii"></a>II - inciso 2.</p>
        <p><a name="art11v"></a>V - inciso 5.</p>
      </body></html>`;
    const parsed = parsePlanaltoLawHtml(html);
    expect(parsed.articles.length).toBe(1);
    expect(parsed.articles[0]?.number).toBe("11");
    // Os 3 incisos devem entrar como paragraphs do art 11.
    expect(parsed.articles[0]?.paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("detecta artigo revogado", () => {
    const html = `
      <html><body>
        <p><a name="art50"></a>Art. 50. (Revogado pela Lei nº 12.345, de 2020).</p>
      </body></html>`;
    const parsed = parsePlanaltoLawHtml(html);
    expect(parsed.articles[0]?.isRevoked).toBe(true);
  });

  it("dedupica artigos repetidos (Planalto às vezes duplica copy-paste)", () => {
    const html = `
      <html><body>
        <p><a name="art12c"></a>Art. 12-C. Texto curto inicial.</p>
        <p><a name="art12c."></a>Art. 12-C. Texto curto inicial.</p>
      </body></html>`;
    const parsed = parsePlanaltoLawHtml(html);
    expect(parsed.articles.length).toBe(1);
  });
});

describe("decodePlanaltoBuffer", () => {
  it("decodifica UTF-16 LE com BOM", () => {
    const text = "Art. 1º Teste";
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    expect(decodePlanaltoBuffer(utf16)).toBe(text);
  });

  it("decodifica UTF-8 com BOM", () => {
    const text = "Art. 1º Teste com ç";
    const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf-8")]);
    expect(decodePlanaltoBuffer(utf8)).toBe(text);
  });

  it("decodifica UTF-8 sem BOM", () => {
    const text = "Art. 1º Teste";
    expect(decodePlanaltoBuffer(Buffer.from(text, "utf-8"))).toBe(text);
  });

  it("detecta UTF-16 LE sem BOM via heurística de bytes nulos", () => {
    const text = "ABCDEFGH";
    const buf = Buffer.from(text, "utf16le");
    expect(decodePlanaltoBuffer(buf)).toBe(text);
  });
});
