import { describe, expect, it } from "vitest";
import {
  humanizeHierarchy,
  parseConstitutionSemantic,
  validateCfSemantic,
} from "./cf-semantic-parser";

const SAMPLE = `# CONSTITUICAO_FEDERAL

 Preâmbulo

Nós, representantes do povo brasileiro, reunidos em Assembléia Nacional Constituinte para instituir um Estado Democrático.

## TITULO_I

[ARTIGO:1]
[META]
codigo=CF
tipo=CONSTITUICAO
hierarquia=TITULO_I>PRINCIPIOS_FUNDAMENTAIS
tema=principios_fundamentais
artigo=1
vigencia=1988
[/META]

A República Federativa do Brasil constitui-se em Estado democrático de direito e tem como fundamentos:

[INCISO:I]
a soberania;

[INCISO:II]
a cidadania;

[INCISO:III]
a dignidade da pessoa humana;

[PARAGRAFO:UNICO]
Todo o poder emana do povo, que o exerce por meio de representantes eleitos.

[ARTIGO:5]
[META]
codigo=CF
tipo=CONSTITUICAO
hierarquia=TITULO_II>DIREITOS_E_GARANTIAS_FUNDAMENTAIS>CAPITULO_I>DIREITOS_DEVERES_INDIVIDUAIS_COLETIVOS
tema=direitos_garantias_fundamentais
artigo=5
vigencia=1988
[/META]

Todos são iguais perante a lei, nos termos seguintes:

[INCISO:LIV]
ninguém será privado da liberdade ou de seus bens sem o devido processo legal;

[INCISO:LV]
aos litigantes, em processo judicial ou administrativo, e aos acusados em geral são assegurados o contraditório e ampla defesa.

[ARTIGO:29-A]
[META]
codigo=CF
tipo=CONSTITUICAO
hierarquia=TITULO_III>ORGANIZACAO_DO_ESTADO>CAPITULO_IV>MUNICIPIOS
tema=organizacao_do_estado
artigo=29-A
vigencia=1988
[/META]

O total da despesa do Poder Legislativo Municipal não poderá ultrapassar:

[INCISO:I]
sete por cento;

[ALINEA:a]
Municípios com população de até 100.000 habitantes;

[ALINEA:b]
Municípios com população entre 100.001 e 300.000 habitantes;

# ADCT

[ARTIGO:1]
[META]
codigo=ADCT
tipo=CONSTITUICAO
hierarquia=ADCT
tema=disposicoes_transitorias
artigo=1
vigencia=1988
[/META]

O Presidente da República, o Presidente do Supremo Tribunal Federal prestarão compromisso.

[DOCUMENT_NOTE]
Brasília, 5 de outubro de 1988.

Ulysses Guimarães, Presidente.
`;

describe("parseConstitutionSemantic", () => {
  const parsed = parseConstitutionSemantic(SAMPLE);

  it("captura o título e o preâmbulo", () => {
    expect(parsed.title).toBe("Constituição Federal");
    expect(parsed.preamble).toMatch(/Nós, representantes do povo/);
  });

  it("conta artigos por segmento", () => {
    expect(parsed.stats.articlesMain).toBe(3); // Art. 1, 5, 29-A
    expect(parsed.stats.articlesAdct).toBe(1);
  });

  it("captura DOCUMENT_NOTE como nota e não como artigo", () => {
    expect(parsed.documentNotes.length).toBe(1);
    expect(parsed.documentNotes[0]?.text).toMatch(/Brasília, 5 de outubro/);
    expect(parsed.articles.find((a) => a.text.includes("Brasília"))).toBeUndefined();
  });

  it("[META] é fonte de verdade pra hierarquia/tema/codigo", () => {
    const a5 = parsed.articles.find((a) => a.number === "5");
    expect(a5?.meta.codigo).toBe("CF");
    expect(a5?.meta.tema).toBe("direitos_garantias_fundamentais");
    expect(a5?.meta.hierarquia).toContain("TITULO_II");
  });

  it("ADCT é diferenciado por meta.codigo e segment", () => {
    const adct1 = parsed.segments.ADCT[0];
    expect(adct1?.segment).toBe("ADCT");
    expect(adct1?.meta.codigo).toBe("ADCT");
  });

  it("ref canônica respeita ordinal (1º) vs cardinal (10) e sufixo (-A)", () => {
    expect(parsed.articles.find((a) => a.number === "1")?.ref).toBe("Art. 1º");
    expect(parsed.articles.find((a) => a.number === "5")?.ref).toBe("Art. 5º");
    expect(parsed.articles.find((a) => a.number === "29-A")?.ref).toBe("Art. 29-A");
  });

  it("estruturas internas ordenadas: incisos, parágrafos e alíneas", () => {
    const a1 = parsed.articles.find((a) => a.number === "1" && a.meta.codigo === "CF");
    expect(a1?.internals.map((p) => p.kind)).toEqual([
      "INCISO",
      "INCISO",
      "INCISO",
      "PARAGRAFO",
    ]);
    expect(a1?.internals.find((p) => p.kind === "PARAGRAFO")?.label).toBe(
      "Parágrafo único",
    );

    const a29 = parsed.articles.find((a) => a.number === "29-A");
    const labels = a29?.internals.map((p) => `${p.kind}:${p.label}`);
    expect(labels).toEqual(["INCISO:I", "ALINEA:a)", "ALINEA:b)"]);
  });

  it("text final é autocontido sem [META] bruto", () => {
    const a5 = parsed.articles.find((a) => a.number === "5");
    expect(a5?.text).not.toMatch(/\[META\]/);
    expect(a5?.text).not.toMatch(/codigo=CF/);
    expect(a5?.text).toMatch(/Art\. 5º\. Todos são iguais/);
    expect(a5?.text).toMatch(/LIV — ninguém será privado/);
    expect(a5?.text).toMatch(/Direitos e Garantias Fundamentais/);
  });

  it("fullPath humanizado a partir do META", () => {
    const a5 = parsed.articles.find((a) => a.number === "5");
    expect(a5?.fullPath).toBe(
      "Título II > Direitos e Garantias Fundamentais > Capítulo I > Direitos Deveres Individuais Coletivos > Art. 5º",
    );
  });

  it("ADCT prefixa 'Constituição Federal. ADCT.' no texto de embedding", () => {
    const adct1 = parsed.segments.ADCT[0];
    expect(adct1?.text.startsWith("Constituição Federal. ADCT.")).toBe(true);
    expect(adct1?.text).not.toMatch(/\[META\]/);
  });
});

describe("parseConstitutionSemantic — strict mode", () => {
  it("falha quando [ARTIGO] não tem [META] imediato", () => {
    const md = `# CF\n\n[ARTIGO:1]\n\nTexto sem META.\n`;
    expect(() => parseConstitutionSemantic(md)).toThrow(/sem \[META\]/);
  });

  it("falha quando [META] não fecha", () => {
    const md = `# CF\n\n[ARTIGO:1]\n[META]\ncodigo=CF\nhierarquia=TI\n\ntexto\n`;
    expect(() => parseConstitutionSemantic(md)).toThrow();
  });

  it("modo lax (strict=false) coleta erros sem jogar", () => {
    const md = `# CF\n\n[ARTIGO:1]\n\nTexto sem META.\n[ARTIGO:2]\n[META]\ncodigo=CF\nhierarquia=TI\n[/META]\nTexto.\n`;
    const out = parseConstitutionSemantic(md, { strict: false });
    expect(out.articles.length).toBe(1);
    expect(out.articles[0]?.number).toBe("2");
  });
});

describe("humanizeHierarchy", () => {
  it("converte tokens conhecidos", () => {
    const path = humanizeHierarchy(
      "TITULO_VIII>ORDEM_SOCIAL>CAPITULO_IV>CIENCIA_TECNOLOGIA_INOVACAO",
      "Art. 218",
    );
    expect(path).toBe(
      "Título VIII > Ordem Social > Capítulo IV > Ciencia Tecnologia Inovacao > Art. 218",
    );
  });

  it("preserva sigla ADCT em maiúsculo", () => {
    expect(humanizeHierarchy("ADCT", "Art. 1º")).toBe("ADCT > Art. 1º");
  });
});

describe("validateCfSemantic", () => {
  it("relata stats e detecta artigos sem META", () => {
    const md = `# CF\n\n[ARTIGO:1]\n\nTexto sem meta.\n[ARTIGO:2]\n[META]\ncodigo=CF\nhierarquia=TI\n[/META]\ntext.\n`;
    const r = validateCfSemantic(md);
    expect(r.stats.articlesMain).toBeGreaterThanOrEqual(1);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("não falha em markdown vazio", () => {
    const r = validateCfSemantic("");
    expect(r.stats.articlesMain).toBe(0);
    expect(r.stats.articlesAdct).toBe(0);
  });
});
