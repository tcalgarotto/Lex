import { describe, it, expect } from "vitest";
import { chunkLegalNormV3 } from "./legal-chunker-v3";

describe("legal chunker v3", () => {
  it("explode Art. 208 em incisos e isola o inciso IV (creche/pré-escola)", () => {
    const raw = [
      "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL",
      "",
      "Art. 208. O dever do Estado com a educação será efetivado mediante a garantia de:",
      "I - ensino fundamental, obrigatório e gratuito, assegurada, inclusive, sua oferta gratuita para todos os que a ele não tiveram acesso na idade própria;",
      "II - progressiva universalização do ensino médio gratuito;",
      "III - atendimento educacional especializado aos portadores de deficiência, preferencialmente na rede regular de ensino;",
      "IV - educação infantil, em creche e pré-escola, às crianças até 5 anos de idade;",
      "V - acesso aos níveis mais elevados do ensino, da pesquisa e da criação artística, segundo a capacidade de cada um;",
    ].join("\n");

    const chunks = chunkLegalNormV3(raw);
    const art208 = chunks.find((c) => c.articleRef === "Art. 208" && c.structure === "ARTIGO");
    expect(art208).toBeTruthy();

    const incisoIV = chunks.find(
      (c) =>
        c.articleRef === "Art. 208" &&
        c.structure === "INCISO" &&
        String(c.incisoRef ?? "").toUpperCase() === "IV",
    );
    expect(incisoIV).toBeTruthy();
    expect(incisoIV!.text).toContain("IV - educação infantil, em creche e pré-escola, às crianças até 5 anos de idade");
    // Garantia: não deve conter texto de outros incisos.
    expect(incisoIV!.text).not.toMatch(/^\s*II\s*[—\-–]/im);
    expect(incisoIV!.text).not.toMatch(/^\s*I\s*[—\-–]\s*ensino/im);
    expect(incisoIV!.text).not.toMatch(/^\s*V\s*[—\-–]/im);
  });
});

