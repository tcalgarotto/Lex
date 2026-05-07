import { describe, expect, it } from "vitest";
import { classifyLegalQuery } from "@/lib/legal/query-classifier";

describe("classifyLegalQuery", () => {
  it("detecta prazo como procedural_deadline e requiresStrongSources", () => {
    const c = classifyLegalQuery("Qual prazo eu tenho para responder esse despacho?");
    expect(c.queryType).toBe("procedural_deadline");
    expect(c.requiresStrongSources).toBe(true);
  });

  it("detecta jurisprudência", () => {
    const c = classifyLegalQuery("Tem jurisprudência do STJ sobre isso?");
    expect(c.requiresStrongSources).toBe(true);
    expect(c.signals.includes("jurisprudence")).toBe(true);
  });

  it("detecta resumo de despacho", () => {
    const c = classifyLegalQuery("Resuma o despacho e diga o que foi determinado.");
    expect(c.queryType).toBe("document_summary");
  });

  it("pergunta genérica", () => {
    const c = classifyLegalQuery("O que significa preclusão consumativa?");
    expect(c.queryType).toBe("generic_question");
  });

  it("estratégia contextual exige documento do processo", () => {
    const c = classifyLegalQuery("O que devo fazer diante desse despacho?");
    expect(c.queryType).toBe("case_strategy");
    expect(c.requiresProcessDocument).toBe(true);
  });
});

