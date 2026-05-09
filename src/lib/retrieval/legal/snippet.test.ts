import { describe, expect, it } from "vitest";
import { extractRelevantSnippet } from "./snippet";

const LONG_ARTICLE = `Art. 208. O dever do Estado com a educação será efetivado mediante a garantia de:
I - educação básica obrigatória e gratuita dos 4 (quatro) aos 17 (dezessete) anos de idade, assegurada inclusive sua oferta gratuita para todos os que a ela não tiveram acesso na idade própria;
II - progressiva universalização do ensino médio gratuito;
III - atendimento educacional especializado aos portadores de deficiência;
IV - educação infantil, em creche e pré-escola, às crianças até 5 (cinco) anos de idade;
V - acesso aos níveis mais elevados do ensino, da pesquisa e da criação artística, segundo a capacidade de cada um;
VI - oferta de ensino noturno regular, adequado às condições do educando;
VII - atendimento ao educando, em todas as etapas da educação básica, por meio de programas suplementares de material didático escolar, transporte, alimentação e assistência à saúde.`;

describe("extractRelevantSnippet", () => {
  it("retorna o texto completo se for menor que maxChars", () => {
    const text = "Curto.";
    expect(extractRelevantSnippet(text, "qualquer", { maxChars: 320 })).toBe(text);
  });

  it("recorta janela ao redor de inciso quando query menciona romano", () => {
    const snippet = extractRelevantSnippet(LONG_ARTICLE, "art. 208 IV creche", {
      maxChars: 200,
    });
    expect(snippet).toContain("creche");
    expect(snippet).toContain("IV");
    expect(snippet.length).toBeLessThanOrEqual(220);
  });

  it("usa keyword rara quando não há inciso na query", () => {
    const snippet = extractRelevantSnippet(LONG_ARTICLE, "creche", {
      maxChars: 180,
    });
    expect(snippet.toLowerCase()).toContain("creche");
  });

  it("aplica ellipsis quando snippet não cobre as bordas", () => {
    const snippet = extractRelevantSnippet(LONG_ARTICLE, "creche", {
      maxChars: 120,
      ellipsis: true,
    });
    expect(snippet.startsWith("…") || snippet.endsWith("…")).toBe(true);
  });

  it("desliga ellipsis quando opt.ellipsis=false", () => {
    const snippet = extractRelevantSnippet(LONG_ARTICLE, "creche", {
      maxChars: 120,
      ellipsis: false,
    });
    expect(snippet.startsWith("…")).toBe(false);
    expect(snippet.endsWith("…")).toBe(false);
  });
});
