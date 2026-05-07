import { describe, expect, it } from "vitest";
import { CorpusProvider } from "@prisma/client";
import { defaultDatajudAlias, providerForTribunalCode } from "./factory";
import { getTribunal } from "./registry";

describe("provider factory por tribunal", () => {
  it("STF -> CorpusProvider.STF", () => {
    expect(providerForTribunalCode("STF").id).toBe(CorpusProvider.STF);
  });
  it("STJ -> CorpusProvider.STJ", () => {
    expect(providerForTribunalCode("STJ").id).toBe(CorpusProvider.STJ);
  });
  it("TST e TSE caem em LEXML (legislação correlata)", () => {
    expect(providerForTribunalCode("TST").id).toBe(CorpusProvider.LEXML);
    expect(providerForTribunalCode("TSE").id).toBe(CorpusProvider.LEXML);
  });
  it("TRFs caem em DATAJUD com alias api_publica_trfX", () => {
    const trf3 = providerForTribunalCode("TRF3");
    expect(trf3.id).toBe(CorpusProvider.DATAJUD);
  });
  it("TJs caem em DATAJUD", () => {
    const tjsp = providerForTribunalCode("TJSP", { datajudApiKey: "k" });
    expect(tjsp.id).toBe(CorpusProvider.DATAJUD);
  });
  it("TRTs/TREs/TJMs caem em DATAJUD", () => {
    expect(providerForTribunalCode("TRT15").id).toBe(CorpusProvider.DATAJUD);
    expect(providerForTribunalCode("TRESP").id).toBe(CorpusProvider.DATAJUD);
    expect(providerForTribunalCode("TJMSP").id).toBe(CorpusProvider.DATAJUD);
  });
  it("alias Datajud default segue convenção api_publica_<code>", () => {
    expect(defaultDatajudAlias(getTribunal("TJSP")!)).toBe("api_publica_tjsp");
    expect(defaultDatajudAlias(getTribunal("TRF4")!)).toBe("api_publica_trf4");
  });
  it("código desconhecido lança", () => {
    expect(() => providerForTribunalCode("TJZZ")).toThrow(/desconhecido/);
  });
});
