import { describe, expect, it } from "vitest";
import { checkDocumentConsistency } from "./consistency";
import type { CaseBrain } from "./brain-types";

function makeBrain(partial: Partial<CaseBrain>): CaseBrain {
  return {
    brainVersion: 1,
    inputHash: "h",
    title: "x",
    area: ["Constitucional"],
    phase: "pre_processual",
    problem: "x",
    objective: "x",
    thesis: "x",
    probableMeasure: { kind: "OBRIGACAO_FAZER", rationale: "x" },
    narrative: "x",
    parties: [],
    facts: [],
    requests: [],
    risks: [],
    evidence: [],
    missingDocuments: [],
    suggestedFoundations: [],
    inconsistencies: [],
    proceduralReadiness: {
      score: 0,
      status: "insuficiente",
      blockers: [],
      missingDocuments: [],
      nextBestAction: "",
      rationale: "",
    },
    generatedAt: new Date().toISOString(),
    ...partial,
  } as CaseBrain;
}

describe("checkDocumentConsistency", () => {
  it("não retorna nada quando não há documentos", () => {
    const brain = makeBrain({});
    const out = checkDocumentConsistency({ brain, documents: [] });
    expect(out).toEqual([]);
  });

  it("não falha quando documento é muito curto", () => {
    const brain = makeBrain({});
    const out = checkDocumentConsistency({
      brain,
      documents: [{ id: "d1", originalName: "x.pdf", text: "abc" }],
    });
    expect(out).toEqual([]);
  });

  it("detecta CPF divergente como HIGH", () => {
    const brain = makeBrain({
      parties: [
        {
          role: "assisted_party",
          name: "Maria da Silva",
          document: "111.222.333-44",
          confidence: 1,
          origin: "input",
          sourceText: "",
        },
      ],
    });
    const out = checkDocumentConsistency({
      brain,
      documents: [
        {
          id: "d1",
          originalName: "rg.pdf",
          text: "Maria da Silva, CPF 999.888.777-66, residente em Camboriú/SC, possui filha menor.",
        },
      ],
    });
    const cpf = out.find((i) => i.kind === "cpf_mismatch");
    expect(cpf).toBeTruthy();
    expect(cpf?.severity).toBe("HIGH");
  });

  it("detecta typo no nome (similaridade ~0.85) como name_typo MEDIUM", () => {
    const brain = makeBrain({
      parties: [
        {
          role: "assisted_party",
          name: "Maria Aparecida da Silva",
          confidence: 1,
          origin: "input",
          sourceText: "",
        },
      ],
    });
    const out = checkDocumentConsistency({
      brain,
      documents: [
        {
          id: "d1",
          originalName: "rg.pdf",
          text: "A presente declaração é para Maria Apareciada da Silv, residente em Camboriú/SC.",
        },
      ],
    });
    const typo = out.find((i) => i.kind === "name_typo");
    expect(typo).toBeTruthy();
    expect(typo?.severity).toBe("MEDIUM");
  });

  it("detecta idade divergente quando |Δ| > 1", () => {
    const brain = makeBrain({
      parties: [
        {
          role: "child_or_dependent",
          name: "Joana Souza",
          age: 3,
          confidence: 1,
          origin: "input",
          sourceText: "",
        },
      ],
    });
    const out = checkDocumentConsistency({
      brain,
      documents: [
        {
          id: "d1",
          originalName: "doc.pdf",
          text: "A criança Joana Souza, com 8 anos de idade, está matriculada na escola.",
        },
      ],
    });
    const age = out.find((i) => i.kind === "age_mismatch");
    expect(age).toBeTruthy();
    // |8 - 3| = 5 > 3 → severity HIGH
    expect(age?.severity).toBe("HIGH");
  });

  it("detecta processo CNJ divergente como CRITICAL", () => {
    const brain = makeBrain({});
    const out = checkDocumentConsistency({
      brain,
      documents: [
        {
          id: "d1",
          originalName: "proc.pdf",
          text: "Processo nº 1234567-89.2024.5.02.1234 está em trâmite.",
        },
      ],
      caseProcessNumber: "9876543-21.2025.4.01.0001",
    });
    const proc = out.find((i) => i.kind === "process_number_mismatch");
    expect(proc).toBeTruthy();
    expect(proc?.severity).toBe("CRITICAL");
  });

  it("não cria inconsistência quando CPF bate (com ou sem máscara)", () => {
    const brain = makeBrain({
      parties: [
        {
          role: "assisted_party",
          name: "Maria",
          document: "11122233344",
          confidence: 1,
          origin: "input",
          sourceText: "",
        },
      ],
    });
    const out = checkDocumentConsistency({
      brain,
      documents: [
        {
          id: "d1",
          originalName: "rg.pdf",
          text: "Maria portadora do CPF 111.222.333-44 está apta. Documento longo o bastante para análise.",
        },
      ],
    });
    expect(out.find((i) => i.kind === "cpf_mismatch")).toBeUndefined();
  });
});
