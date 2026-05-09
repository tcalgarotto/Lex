import { describe, expect, it } from "vitest";
import { suggestChecklistTemplate } from "@/lib/cases/checklists/registry";
import { computeProceduralReadiness } from "@/lib/cases/readiness";
import { checkDocumentConsistency } from "@/lib/cases/consistency";
import { getCorpusManifest } from "@/lib/corpus/manifest";
import type {
  BrainFact,
  BrainParty,
  BrainRequest,
  CaseBrain,
} from "@/lib/cases/brain-types";

/**
 * Integration (sem criar Case — usa apenas Postgres para manifest).
 * Simula o fluxo "creche Camboriú" descrito no QA manual: checklist certo,
 * prontidão alta quando dados completos, inconsistência quando CPF diverge.
 */
describe("case brain — cenário creche Camboriú", () => {
  it("sugere checklist constitucional.educacao.creche a partir do relato típico", () => {
    const tpl = suggestChecklistTemplate({
      rawText:
        "Dra., minha filha Lara de 4 anos está sem vaga na creche municipal de Camboriú. Fui na prefeitura e mandaram esperar.",
    });
    expect(tpl?.id).toBe("constitucional.educacao.creche");
  });

  it("computeProceduralReadiness retorna score alto quando checklist + docs estão completos", () => {
    const parties: BrainParty[] = [
      {
        role: "assisted_party",
        name: "Ana Paula da Silva",
        address: "Camboriú/SC",
        confidence: 1,
        origin: "input",
        sourceText: "",
      },
      {
        role: "child_or_dependent",
        name: "Lara Souza",
        age: 4,
        confidence: 1,
        origin: "input",
        sourceText: "",
      },
    ];
    const facts: BrainFact[] = [
      {
        text: "Cliente foi à Secretaria de Educação e não conseguiu vaga.",
        confidence: 1,
        origin: "input",
        sourceText: "",
        evidenceRefs: [],
      },
      {
        text: "Município respondeu negativamente ao pedido administrativo.",
        confidence: 1,
        origin: "input",
        sourceText: "",
        evidenceRefs: [],
      },
    ];
    const requests: BrainRequest[] = [
      {
        text: "Concessão de vaga em creche municipal",
        kind: "MAIN",
        confidence: 1,
        origin: "input",
        sourceText: "",
      },
      {
        text: "Tutela de urgência para matrícula imediata",
        kind: "URGENCY",
        confidence: 1,
        origin: "input",
        sourceText: "",
      },
    ];

    const r = computeProceduralReadiness({
      parties,
      facts,
      requests,
      evidence: [
        { kind: "document", confidence: 1, origin: "input", sourceText: "" } as never,
      ],
      missingDocuments: [],
      documents: [
        { id: "d1", originalName: "certidao_lara.pdf" },
        { id: "d2", originalName: "comprovante_residencia.pdf" },
        { id: "d3", originalName: "protocolo_prefeitura.pdf" },
      ],
      area: ["Educação", "Infância"],
      probableAuthority: {
        name: "Secretária",
        role: "Secretária Municipal",
        entity: "Secretaria Municipal de Educação de Camboriú",
        confidence: 1,
        origin: "input",
        sourceText: "",
      },
      checklistResponses: {
        templateId: "constitucional.educacao.creche",
        version: 1,
        answers: {
          child_birthdate: "2021-06-01",
          address: "Rua das Flores, Camboriú/SC",
          admin_request_made: true,
          admin_request_protocol: "2025.123456",
          municipality_response: "negativa por falta de vaga",
          urgency_factors: ["trabalho da genitora"],
        },
        answeredAt: new Date().toISOString(),
      },
    });

    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(["boa", "pronta_para_minuta"]).toContain(r.status);
    expect(r.nextBestAction.length).toBeGreaterThan(0);
  });

  it("checkDocumentConsistency detecta CPF divergente entre brain e RG", () => {
    const brain: CaseBrain = {
      brainVersion: 1,
      inputHash: "x",
      title: "Caso teste",
      area: ["Constitucional"],
      phase: "pre_processual",
      problem: "sem vaga",
      objective: "vaga",
      thesis: "CF 208",
      probableMeasure: { kind: "MS", rationale: "x" },
      narrative: "x",
      parties: [
        {
          role: "assisted_party",
          name: "Ana Paula da Silva",
          document: "529.982.247-25",
          confidence: 1,
          origin: "input",
          sourceText: "",
        },
      ],
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
    };

    const out = checkDocumentConsistency({
      brain,
      documents: [
        {
          id: "rg",
          originalName: "rg_ana.pdf",
          text: `Este é um documento com texto suficientemente longo para passar no limiar de 20 caracteres.
          Ana Paula da Silva, brasileira, portadora do CPF nº 111.444.777-35, residente em Camboriú.`,
        },
      ],
    });

    expect(out.some((i) => i.kind === "cpf_mismatch")).toBe(true);
  });

  it("getCorpusManifest consulta Postgres e retorna estrutura válida", async () => {
    const m = await getCorpusManifest();
    expect(m.generatedAt instanceof Date).toBe(true);
    expect(m.availableUrns).toBeDefined();
    expect(Array.isArray(m.availableNorms)).toBe(true);
    expect(Array.isArray(m.unavailableHints)).toBe(true);
  });
});
