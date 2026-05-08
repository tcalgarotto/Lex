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

  it("regressão: NÃO gera dezenas de chunks quase-idênticos quando o resíduo é menor que overlap (bug visto na LMP Art. 12)", () => {
    // Texto com 15 quebras de linha, ~2200 chars (cenário do Art. 12 LMP).
    const lines = [
      "Art. 12. Em todos os casos de violência doméstica, deverá a autoridade policial adotar:",
      "I - ouvir a ofendida, lavrar boletim e tomar a representação a termo;",
      "II - colher todas as provas que servirem para o esclarecimento;",
      "III - remeter, no prazo de 48 horas, expediente apartado ao juiz;",
      "IV - determinar identificação criminal e juntar folha de antecedentes;",
      "V - ouvir o agressor e as testemunhas;",
      "VI - ordenar a identificação do agressor;",
      "VII - remeter, no prazo legal, os autos do inquérito policial;",
      "§ 1º O pedido referido no inciso III conterá: I - qualificação; II - nome; III - estado civil; IV - boletim;",
      "§ 2º A autoridade policial deverá anexar ao documento referido no § 1º o boletim de ocorrência.",
      "§ 3º Serão admitidos como meios de prova os laudos médicos fornecidos por hospitais e postos de saúde.",
    ];
    // Repete cada linha pra simular ~2200 chars.
    const long = lines
      .map((l) => l + " " + "x".repeat(120))
      .join("\n");
    expect(long.length).toBeGreaterThan(1800);
    const chunks = chunkLegalNorm(long, { maxChars: 1800, overlap: 180 });
    // Esperado: ~2-3 chunks pra 2.2KB. Antes do fix: 180+ chunks.
    expect(chunks.length).toBeLessThan(8);
    // Todos com mesmo articleRef.
    const arts = new Set(chunks.map((c) => c.articleRef));
    expect(arts.size).toBe(1);
    expect([...arts][0]).toMatch(/^Art\. 12/);
  });

  it("janela avança pelo menos 50% de maxChars por iteração (proteção contra loops degenerados)", () => {
    const long = "Art. 99. " + "X".repeat(5000);
    const chunks = chunkLegalNorm(long, { maxChars: 1000, overlap: 200 });
    // 5000 chars / passo mínimo 500 = no máximo ~10 chunks. Sem proteção
    // mínima, o algoritmo gerava centenas.
    expect(chunks.length).toBeLessThanOrEqual(15);
  });
});
