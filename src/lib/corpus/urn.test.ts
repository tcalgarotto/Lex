import { describe, expect, it } from "vitest";
import { NormJurisdiction, NormKind } from "@prisma/client";
import {
  buildCanonicalUrn,
  classifyJurisdictionFromUrn,
  classifyKindFromUrn,
  humanIdentifier,
  normalizeUrnPart,
  parseUrnLex,
  UrnLexError,
} from "./urn";

describe("urn-lex/parse", () => {
  it("parseia Lei federal canônica", () => {
    const u = parseUrnLex("urn:lex:br:federal:lei:1990-09-11;8078");
    expect(u.country).toBe("br");
    expect(u.authority).toBe("federal");
    expect(u.documentType).toBe("lei");
    expect(u.date).toBe("1990-09-11");
    expect(u.number).toBe("8078");
    expect(u.uf).toBeUndefined();
    expect(u.fragment).toBeUndefined();
  });

  it("parseia URN com fragmento", () => {
    const u = parseUrnLex(
      "urn:lex:br:superior.tribunal.justica:resp:2019-04-23;1797175!ementa",
    );
    expect(u.fragment).toBe("ementa");
    expect(u.authority).toBe("superior.tribunal.justica");
    expect(u.documentType).toBe("resp");
  });

  it("parseia URN estadual com UF", () => {
    const u = parseUrnLex("urn:lex:br:sp;estadual:lei:2010-05-20;13800");
    expect(u.uf).toBe("sp");
    expect(u.authority).toBe("estadual");
    expect(u.number).toBe("13800");
  });

  it("normaliza para lowercase e canonicaliza", () => {
    const u = parseUrnLex("URN:LEX:BR:FEDERAL:LEI:1990-09-11;8078");
    expect(u.urn).toBe("urn:lex:br:federal:lei:1990-09-11;8078");
  });

  it("aceita data como ano apenas", () => {
    const u = parseUrnLex("urn:lex:br:federal:decreto:1969;1001");
    expect(u.date).toBe("1969-01-01");
    expect(u.number).toBe("1001");
  });

  it("falha em entrada não-URN", () => {
    expect(() => parseUrnLex("não é urn")).toThrow(UrnLexError);
    expect(() => parseUrnLex("urn:lex:br")).toThrow(UrnLexError);
  });
});

describe("urn-lex/build", () => {
  it("build canônico produz a mesma URN do parse", () => {
    const original = "urn:lex:br:federal:lei:1990-09-11;8078";
    const parsed = parseUrnLex(original);
    expect(parsed.urn).toBe(original);
  });

  it("normalizeUrnPart remove acentos e força lowercase", () => {
    expect(normalizeUrnPart("Súmula Vinculante")).toBe("sumula-vinculante");
    expect(normalizeUrnPart("Tribunal de Justiça")).toBe("tribunal-de-justica");
  });

  it("inclui UF quando estadual", () => {
    const built = buildCanonicalUrn({
      uf: "SP",
      authority: "estadual",
      documentType: "lei",
      date: "2010-05-20",
      number: "13800",
    });
    expect(built).toBe("urn:lex:br:sp;estadual:lei:2010-05-20;13800");
  });

  it("inclui fragmento", () => {
    const built = buildCanonicalUrn({
      authority: "federal",
      documentType: "lei",
      date: "1990-09-11",
      number: "8078",
      fragment: "art47",
    });
    expect(built).toBe("urn:lex:br:federal:lei:1990-09-11;8078!art47");
  });
});

describe("urn-lex/classify", () => {
  it("classifica leis e decretos federais", () => {
    expect(classifyKindFromUrn(parseUrnLex("urn:lex:br:federal:lei:1990-09-11;8078"))).toBe(
      NormKind.ORDINARY_LAW,
    );
    expect(
      classifyKindFromUrn(parseUrnLex("urn:lex:br:federal:lei.complementar:2003-01-14;116")),
    ).toBe(NormKind.COMPLEMENTARY_LAW);
    expect(classifyKindFromUrn(parseUrnLex("urn:lex:br:federal:decreto-lei:1969-10-01;1001"))).toBe(
      NormKind.DECREE_LAW,
    );
    expect(
      classifyKindFromUrn(parseUrnLex("urn:lex:br:federal:emenda.constitucional:2023-12-20;132")),
    ).toBe(NormKind.CONSTITUTIONAL_AMENDMENT);
    expect(
      classifyKindFromUrn(parseUrnLex("urn:lex:br:federal:medida.provisoria:2023-08-28;1185")),
    ).toBe(NormKind.PROVISIONAL_MEASURE);
  });

  it("classifica súmulas STF/STJ", () => {
    expect(
      classifyKindFromUrn(
        parseUrnLex("urn:lex:br:supremo.tribunal.federal:sumula.vinculante:2007-10-30;14"),
      ),
    ).toBe(NormKind.SUMULA_VINCULANTE);
    expect(
      classifyKindFromUrn(parseUrnLex("urn:lex:br:superior.tribunal.justica:sumula:2014-09-22;511")),
    ).toBe(NormKind.SUMULA_STJ);
  });

  it("classifica acórdãos STF/STJ", () => {
    expect(
      classifyKindFromUrn(
        parseUrnLex("urn:lex:br:supremo.tribunal.federal:adi:2019-04-26;5938"),
      ),
    ).toBe(NormKind.JURISPRUDENCE_STF);
    expect(
      classifyKindFromUrn(parseUrnLex("urn:lex:br:superior.tribunal.justica:resp:2019-04-23;1797175")),
    ).toBe(NormKind.JURISPRUDENCE_STJ);
  });

  it("jurisdição: federal vs estadual vs corte", () => {
    expect(
      classifyJurisdictionFromUrn(parseUrnLex("urn:lex:br:federal:lei:1990-09-11;8078")),
    ).toBe(NormJurisdiction.FEDERAL);
    expect(
      classifyJurisdictionFromUrn(parseUrnLex("urn:lex:br:sp;estadual:lei:2010-05-20;13800")),
    ).toBe(NormJurisdiction.STATE);
    expect(
      classifyJurisdictionFromUrn(
        parseUrnLex("urn:lex:br:supremo.tribunal.federal:sumula.vinculante:2007-10-30;14"),
      ),
    ).toBe(NormJurisdiction.COURT);
  });

  it("humanIdentifier formata leis e súmulas", () => {
    expect(humanIdentifier(parseUrnLex("urn:lex:br:federal:lei:1990-09-11;8078"))).toBe(
      "Lei nº 8078/1990",
    );
    expect(
      humanIdentifier(
        parseUrnLex("urn:lex:br:supremo.tribunal.federal:sumula.vinculante:2007-10-30;14"),
      ),
    ).toBe("Súmula Vinculante 14/2007");
  });
});
