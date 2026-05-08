import { describe, expect, it } from "vitest";
import { parseConstitutionMarkdown } from "./markdown-cf-parser";

const CF_SAMPLE = `# Constituição da República Federativa do Brasil

 **Preâmbulo**

Nós, representantes do povo brasileiro, reunidos em Assembléia Nacional Constituinte para instituir um Estado Democrático.

## Título I: Dos Princípios Fundamentais

**Art. 1º** A República Federativa do Brasil constitui-se em Estado democrático de direito e tem como fundamentos:

  I - a soberania;

  II - a cidadania;

  III - a dignidade da pessoa humana;

 **Parágrafo único.** Todo o poder emana do povo, que o exerce por meio de representantes eleitos.

**Art. 2º** São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.

## Título II: Dos Direitos e Garantias Fundamentais

### Capítulo I: Dos Direitos e Deveres Individuais e Coletivos

**Art. 5º** Todos são iguais perante a lei, nos termos seguintes:

  I - homens e mulheres são iguais em direitos;

 **§ 1º** As normas definidoras dos direitos têm aplicação imediata.

#### Seção I: Disposições Gerais

**Art. 37.** A administração pública obedecerá aos princípios de legalidade, impessoalidade, moralidade.

**Art. 29-A.** O total da despesa do Poder Legislativo Municipal não poderá ultrapassar.

## Ato das Disposições Constitucionais Transitórias

**Art. 1º** O Presidente da República, o Presidente do Supremo Tribunal Federal prestarão compromisso de manter a Constituição.

**Art. 2º** No dia 7 de setembro de 1993 o eleitorado definirá, através de plebiscito, a forma e o sistema de governo.
`;

describe("parseConstitutionMarkdown", () => {
  const parsed = parseConstitutionMarkdown(CF_SAMPLE);

  it("extrai o título canônico", () => {
    expect(parsed.title).toBe("Constituição da República Federativa do Brasil");
  });

  it("captura o preâmbulo", () => {
    expect(parsed.preamble).toMatch(/Nós, representantes do povo brasileiro/);
  });

  it("conta artigos do corpo principal e do ADCT separadamente", () => {
    expect(parsed.cfStats.articlesMain).toBe(5); // 1, 2, 5, 37, 29-A
    expect(parsed.cfStats.articlesAdct).toBe(2); // ADCT 1, 2
  });

  it("preserva ordem natural (1, 2, 5, 37, 29-A) — sem reordenação", () => {
    const main = parsed.segments[0]!.articles;
    expect(main.map((a) => a.number)).toEqual(["1", "2", "5", "37", "29-A"]);
  });

  it("captura sufixo -A (Art. 29-A)", () => {
    const a29a = parsed.articles.find((a) => a.number === "29-A");
    expect(a29a).toBeDefined();
    expect(a29a?.suffix).toBe("A");
    expect(a29a?.ref).toBe("Art. 29-A");
  });

  it("breadcrumb fullPath inclui Título e Capítulo quando aplicável", () => {
    const a5 = parsed.articles.find((a) => a.number === "5");
    expect(a5?.fullPath).toContain("Constituição");
    expect(a5?.fullPath).toContain("Título II");
    expect(a5?.fullPath).toContain("Capítulo I");
    expect(a5?.fullPath).toContain("Art. 5º");
  });

  it("breadcrumb do ADCT prefixa 'ADCT'", () => {
    const adct1 = parsed.segments[1]!.articles.find((a) => a.number === "1");
    expect(adct1?.fullPath).toContain("ADCT");
    expect(adct1?.fullPath).toContain("Art. 1º");
  });

  it("captura inciso como paragraph", () => {
    const a1 = parsed.articles.find((a) => a.number === "1" && a.fullPath.includes("Princípios"));
    expect(a1?.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(a1?.paragraphs.map((p) => p.ref)).toEqual(
      expect.arrayContaining(["I", "II", "III"]),
    );
  });

  it("captura parágrafo único e § 1º", () => {
    const a1 = parsed.articles.find((a) => a.number === "1" && a.fullPath.includes("Princípios"));
    const refs = a1?.paragraphs.map((p) => p.ref) ?? [];
    expect(refs.some((r) => /Par[áa]grafo/i.test(r))).toBe(true);

    const a5 = parsed.articles.find((a) => a.number === "5");
    const a5Refs = a5?.paragraphs.map((p) => p.ref) ?? [];
    expect(a5Refs.some((r) => /§\s*1/.test(r))).toBe(true);
  });

  it("texto do artigo agrega caput + parágrafos", () => {
    const a1 = parsed.articles.find((a) => a.number === "1" && a.fullPath.includes("Princípios"));
    expect(a1?.text).toMatch(/^Art\. 1º .*soberania/s);
    expect(a1?.text).toMatch(/Parágrafo único/);
  });

  it("não classifica como revogado quando não há marca explícita", () => {
    expect(parsed.articles.every((a) => !a.isRevoked)).toBe(true);
  });

  it("flag de revogado quando texto começa com '(Revogado'", () => {
    const md = `# CF\n\n## Título I\n\n**Art. 50.** (Revogado pela EC nº 99/2017).\n`;
    const out = parseConstitutionMarkdown(md);
    expect(out.articles[0]?.isRevoked).toBe(true);
  });

  it("stats.bytes corresponde ao tamanho UTF-8 do markdown de entrada", () => {
    expect(parsed.stats.bytes).toBe(Buffer.byteLength(CF_SAMPLE, "utf8"));
  });
});

describe("parseConstitutionMarkdown — formato h4 (#### Art. Nº)", () => {
  const CF_H4 = `# Constituição da República Federativa do Brasil

## Título I: Dos Princípios Fundamentais

#### Art. 1º A República Federativa do Brasil constitui-se em Estado democrático.

  I - a soberania;

  II - a cidadania;

#### Art. 10. É assegurada a participação dos trabalhadores.

## Título III: Da Organização do Estado

### Capítulo VII: Da Administração Pública

#### Seção I: Disposições Gerais

#### Art. 37. A administração pública obedecerá aos princípios.

#### Art. 29-A. O total da despesa.

## Ato das Disposições Constitucionais Transitórias

#### Art. 1º O Presidente da República prestará compromisso.
`;
  const parsed = parseConstitutionMarkdown(CF_H4);

  it("parser de h4 captura o mesmo número de artigos", () => {
    expect(parsed.articles.length).toBe(5);
    expect(parsed.cfStats.articlesMain).toBe(4);
    expect(parsed.cfStats.articlesAdct).toBe(1);
  });

  it("parser de h4 captura sufixo -A", () => {
    const a29 = parsed.articles.find((a) => a.number === "29-A");
    expect(a29?.ref).toBe("Art. 29-A");
  });

  it("parser de h4 distingue Art. (h4) de Seção (h4)", () => {
    const a37 = parsed.articles.find((a) => a.number === "37");
    expect(a37).toBeDefined();
    expect(a37?.fullPath).toContain("Seção I");
    expect(a37?.fullPath).toContain("Capítulo VII");
  });

  it("parser de h4 não deixa 'Seção' virar artigo", () => {
    const refs = parsed.articles.map((a) => a.ref);
    expect(refs.every((r) => r.startsWith("Art. "))).toBe(true);
  });

  it("regressão: caput iniciado por letra maiúscula NÃO vira sufixo", () => {
    const md = `# CF
## Título I
#### Art. 1º A República Federativa.
#### Art. 2º São Poderes.
#### Art. 3º Constituem objetivos.
#### Art. 29-A. O total da despesa.
`;
    const out = parseConstitutionMarkdown(md);
    const numbers = out.articles.map((a) => a.number);
    // Antes do fix, "1-A", "2-S", "3-C" surgiam como falsos sufixos.
    expect(numbers).toEqual(["1", "2", "3", "29-A"]);
    expect(out.articles.find((a) => a.number === "29-A")?.suffix).toBe("A");
    expect(out.articles.find((a) => a.number === "1")?.suffix).toBeUndefined();
  });

  it("aceita variação com espaço ao redor do hífen (estilo Planalto)", () => {
    const md = `# CF\n## Título\n#### Art. 313 -A. Hipótese de prisão preventiva.\n`;
    const out = parseConstitutionMarkdown(md);
    expect(out.articles[0]?.number).toBe("313-A");
    expect(out.articles[0]?.suffix).toBe("A");
  });
});

describe("parseConstitutionMarkdown — robustez", () => {
  it("não explode com markdown vazio", () => {
    const out = parseConstitutionMarkdown("");
    expect(out.articles.length).toBe(0);
    expect(out.cfStats.articlesMain).toBe(0);
    expect(out.cfStats.articlesAdct).toBe(0);
  });

  it("ignora linhas avulsas que não casam com nenhum padrão", () => {
    const md = `# CF\n\nLorem ipsum dolor sit amet.\n\n**Art. 1º** Texto canônico.\n`;
    const out = parseConstitutionMarkdown(md);
    expect(out.articles.length).toBe(1);
    expect(out.articles[0]?.text).toMatch(/Texto canônico/);
  });
});
