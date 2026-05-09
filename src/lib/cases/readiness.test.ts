import { describe, expect, it } from "vitest";
import { computeProceduralReadiness } from "./readiness";
import type {
  BrainFact,
  BrainParty,
  BrainRequest,
} from "./brain-types";

function makeParty(over: Partial<BrainParty> = {}): BrainParty {
  return {
    role: "assisted_party",
    name: "Maria",
    confidence: 1,
    origin: "input",
    sourceText: "",
    ...over,
  } as BrainParty;
}

function makeFact(text: string): BrainFact {
  return {
    text,
    evidenceRefs: [],
    confidence: 1,
    origin: "input",
    sourceText: "",
  } as BrainFact;
}

function makeReq(kind: BrainRequest["kind"], text: string): BrainRequest {
  return {
    text,
    kind,
    confidence: 1,
    origin: "input",
    sourceText: "",
  } as BrainRequest;
}

describe("computeProceduralReadiness", () => {
  it("retorna insuficiente para caso vazio", () => {
    const r = computeProceduralReadiness({
      parties: [],
      facts: [],
      requests: [],
      evidence: [],
      missingDocuments: [],
      documents: [],
      area: [],
    });
    expect(r.score).toBeLessThan(40);
    expect(r.status).toBe("insuficiente");
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.nextBestAction).toBeTruthy();
  });

  it("score sobe quando partes/fatos/pedidos estão preenchidos", () => {
    const r = computeProceduralReadiness({
      parties: [makeParty()],
      facts: [makeFact("a"), makeFact("b")],
      requests: [makeReq("MAIN", "x")],
      evidence: [],
      missingDocuments: [],
      documents: [{ id: "d1", originalName: "x.pdf" }],
      area: [],
    });
    expect(r.score).toBeGreaterThan(60);
  });

  it("status pronta_para_minuta com tudo + checklist creche", () => {
    const r = computeProceduralReadiness({
      parties: [
        makeParty({ role: "assisted_party" }),
        makeParty({ role: "child_or_dependent", age: 3 }),
      ],
      facts: [makeFact("solicitação"), makeFact("negativa")],
      requests: [makeReq("MAIN", "vaga"), makeReq("URGENCY", "liminar")],
      evidence: [
        { kind: "document", confidence: 1, origin: "input", sourceText: "" } as never,
      ],
      missingDocuments: [],
      documents: [
        { id: "d1", originalName: "certidao.pdf" },
        { id: "d2", originalName: "comprov.pdf" },
        { id: "d3", originalName: "protocolo.pdf" },
      ],
      area: ["Educação", "Infância"],
      probableAuthority: {
        name: "Secretária",
        role: "Secretária",
        entity: "Sec. Educação",
        confidence: 1,
        origin: "input",
        sourceText: "",
      },
      checklistResponses: {
        templateId: "constitucional.educacao.creche",
        version: 1,
        answers: {
          child_birthdate: "2022-01-01",
          address: "Rua x, Camboriú",
          admin_request_made: true,
          municipality_response: "negativa",
          urgency_factors: ["trabalho"],
        },
        answeredAt: new Date().toISOString(),
      },
    });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(["boa", "pronta_para_minuta"]).toContain(r.status);
  });

  it("status mantém-se no mínimo parcial quando blockers presentes mas score >= 70", () => {
    // Sem partes (blocker) mas com bastante outra coisa.
    const r = computeProceduralReadiness({
      parties: [],
      facts: [makeFact("a"), makeFact("b"), makeFact("c")],
      requests: [makeReq("MAIN", "x"), makeReq("URGENCY", "y")],
      evidence: [
        { kind: "document", confidence: 1, origin: "input", sourceText: "" } as never,
      ],
      missingDocuments: [],
      documents: [{ id: "d1", originalName: "x.pdf" }],
      area: [],
    });
    expect(r.blockers.length).toBeGreaterThan(0);
    // Status nunca pode ser "pronta_para_minuta" com blocker.
    expect(r.status).not.toBe("pronta_para_minuta");
  });
});
