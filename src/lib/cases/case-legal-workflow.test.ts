import { describe, expect, it } from "vitest";
import { computeCaseLegalWorkflow } from "./case-legal-workflow";
import type { DocumentStatus } from "@prisma/client";

const baseCtx = (over: Partial<Parameters<typeof computeCaseLegalWorkflow>[0]> = {}) => ({
  metadataJson: {},
  rawInput: "x".repeat(25),
  checklistMissingCount: 0,
  checklistAnsweredAt: "2024-01-01",
  documents: [] as Array<{ status: DocumentStatus; updatedAt: Date }>,
  facts: [] as { id: string }[],
  parties: [] as { id: string }[],
  requests: [] as { id: string }[],
  legalSources: [] as { id: string }[],
  drafts: [] as { id: string }[],
  reviews: [] as { id: string }[],
  readiness: null,
  draftBlocked: false,
  caseUpdatedAt: new Date("2024-06-01T12:00:00"),
  caseCreatedAt: new Date("2024-05-01"),
  openRiskCount: 0,
  ...over,
});

describe("computeCaseLegalWorkflow", () => {
  it("caso novo sem documentos fica na fase Documentos após coleta", () => {
    const w = computeCaseLegalWorkflow(
      baseCtx({
        documents: [],
        facts: [],
        parties: [{ id: "p1" }],
        requests: [{ id: "r1" }],
      }),
    );
    expect(w.currentPhaseId).toBe("documentos");
  });

  it("entrevista fundamental salva avança para documentos sem materializar partes", () => {
    const w = computeCaseLegalWorkflow(
      baseCtx({
        intakeMode: "fundamental_draft",
        checklistMissingCount: 0,
        checklistAnsweredAt: null,
        metadataJson: { intakeForm: { attend: { suggestedTitle: "Teste" } } },
        documents: [],
        facts: [],
        parties: [],
        requests: [],
      }),
    );
    expect(w.currentPhaseId).toBe("documentos");
  });

  it("entrevista pendente mantém fase Coleta", () => {
    const w = computeCaseLegalWorkflow(
      baseCtx({
        checklistMissingCount: 2,
        checklistAnsweredAt: null,
        rawInput: "",
      }),
    );
    expect(w.currentPhaseId).toBe("coleta");
    expect(w.blockerMessages.some((m) => /entrevista/i.test(m))).toBe(true);
  });

  it("protocolo nunca automático sem flag em metadata", () => {
    const w = computeCaseLegalWorkflow(
      baseCtx({
        documents: [{ status: "INDEXED", updatedAt: new Date() }],
        facts: [{ id: "f1" }],
        parties: [{ id: "p1" }],
        requests: [{ id: "r1" }],
        legalSources: [{ id: "l1" }],
        metadataJson: { strategy: { ok: true } },
        drafts: [{ id: "d1" }],
        reviews: [{ id: "rv1" }],
      }),
    );
    expect(w.currentPhaseId).toBe("protocolo");
    expect(w.phases.find((p) => p.id === "protocolo")?.state).toBe("current");
  });

  it("protocolo concluído apenas com confirmação manual no metadata", () => {
    const w = computeCaseLegalWorkflow(
      baseCtx({
        documents: [{ status: "INDEXED", updatedAt: new Date() }],
        facts: [{ id: "f1" }],
        parties: [{ id: "p1" }],
        requests: [{ id: "r1" }],
        legalSources: [{ id: "l1" }],
        metadataJson: {
          strategy: { ok: true },
          brain: { workflow: { protocolReadyConfirmed: true } },
        },
        drafts: [{ id: "d1" }],
        reviews: [{ id: "rv1" }],
      }),
    );
    expect(w.flowComplete).toBe(true);
    expect(w.phases.every((p) => p.state === "done")).toBe(true);
  });
});
