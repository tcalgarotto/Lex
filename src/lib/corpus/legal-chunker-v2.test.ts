import { describe, expect, it } from "vitest";
import { chunkLegalNorm } from "./legal-chunker-v2";

const CDC_SAMPLE = `LEI Nº 8.078, DE 11 DE SETEMBRO DE 1990.

Dispõe sobre a proteção do consumidor e dá outras providências.

TÍTULO I
DOS DIREITOS DO CONSUMIDOR

CAPÍTULO I
DISPOSIÇÕES GERAIS

Art. 1º O presente código estabelece normas de proteção e defesa do consumidor, de ordem pública e interesse social.

Art. 2º Consumidor é toda pessoa física ou jurídica que adquire ou utiliza produto ou serviço como destinatário final.
Parágrafo único. Equipara-se a consumidor a coletividade de pessoas que haja intervindo nas relações de consumo.

Art. 6º São direitos básicos do consumidor:
I — a proteção da vida, saúde e segurança;
II — a educação e divulgação sobre o consumo adequado;
III — a informação adequada e clara sobre os diferentes produtos.

CAPÍTULO II
DA POLÍTICA NACIONAL DE RELAÇÕES DE CONSUMO

Art. 4º A Política Nacional das Relações de Consumo tem por objetivo o atendimento das necessidades dos consumidores.`;

describe("chunkLegalNorm", () => {
  it("preserva referência a artigos e breadcrumb hierárquico", () => {
    const chunks = chunkLegalNorm(CDC_SAMPLE);
    const arts = chunks.filter((c) => c.structure === "ARTIGO");
    expect(arts.length).toBeGreaterThanOrEqual(4);

    const art1 = arts.find((c) => c.articleRef === "Art. 1º");
    expect(art1).toBeDefined();
    expect(art1!.fullPath).toContain("Título");
    expect(art1!.fullPath).toContain("Capítulo");
    expect(art1!.fullPath).toContain("Art. 1º");

    const art4 = arts.find((c) => c.articleRef === "Art. 4º");
    expect(art4).toBeDefined();
    expect(art4!.fullPath).toContain("Capítulo II");
  });

  it("captura parágrafo único como ref intra-artigo", () => {
    const chunks = chunkLegalNorm(CDC_SAMPLE);
    const art2 = chunks.find((c) => c.articleRef === "Art. 2º");
    expect(art2).toBeDefined();
    expect(art2!.text).toContain("Parágrafo único");
    expect(art2!.paragraphRef).toBe("único");
  });

  it("agrupa incisos sob o artigo-pai, mantendo o último incisoRef", () => {
    const chunks = chunkLegalNorm(CDC_SAMPLE);
    const art6 = chunks.find((c) => c.articleRef === "Art. 6º");
    expect(art6).toBeDefined();
    expect(art6!.incisoRef).toBeDefined();
    expect(art6!.text).toMatch(/I —|II —|III —/);
  });

  it("texto sem hierarquia produz chunks GENERIC com window", () => {
    const raw = "Lorem ipsum ".repeat(2000);
    const chunks = chunkLegalNorm(raw, { maxChars: 800, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.structure === "GENERIC")).toBe(true);
  });

  it("ordinal é monotônico e estável", () => {
    const chunks = chunkLegalNorm(CDC_SAMPLE);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.ordinal).toBe(i);
    }
    // Idempotência
    const again = chunkLegalNorm(CDC_SAMPLE);
    expect(again.length).toBe(chunks.length);
    expect(again.map((c) => c.text)).toEqual(chunks.map((c) => c.text));
  });

  it("texto vazio produz lista vazia", () => {
    expect(chunkLegalNorm("")).toEqual([]);
    expect(chunkLegalNorm("   \n\n  ")).toEqual([]);
  });

  it("artigo muito longo é dividido por window mantendo articleRef", () => {
    const long = "Art. 5º " + "Texto extenso ".repeat(500);
    const chunks = chunkLegalNorm(long, { maxChars: 600, overlap: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.articleRef === "Art. 5º")).toBe(true);
    expect(chunks.every((c) => c.structure === "ARTIGO")).toBe(true);
  });
});
