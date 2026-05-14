import { describe, expect, it } from "vitest";
import { resolveCaseCockpitPrimaryAction } from "./case-cockpit-primary-action";

const base = {
  caseId: "case-1",
  checklistMissingCount: 0,
  documents: [] as Array<{ status: "INDEXED"; updatedAt: string }>,
  facts: [] as { id: string }[],
  parties: [] as { id: string }[],
  requests: [] as { id: string }[],
  legalSources: [] as { id: string }[],
  drafts: [] as { id: string }[],
  reviews: [] as { id: string }[],
  metadataJson: {},
};

describe("resolveCaseCockpitPrimaryAction", () => {
  it("prioriza entrevista quando há itens pendentes no checklist", () => {
    const a = resolveCaseCockpitPrimaryAction(
      { ...base, checklistMissingCount: 2 },
      { draftBlocked: false },
    );
    expect(a.kind).toBe("link");
    if (a.kind === "link") expect(a.href).toContain("/entrevista");
    expect(a.label).toMatch(/entrevista/i);
  });

  it("sem documentos sugere enviar documento", () => {
    const a = resolveCaseCockpitPrimaryAction(base, { draftBlocked: false });
    expect(a.kind).toBe("link");
    if (a.kind === "link") expect(a.href).toContain("/documentos");
    expect(a.label).toMatch(/documento/i);
  });

  it("com estratégia e sem peça retorna gerar peça quando não bloqueado", () => {
    const a = resolveCaseCockpitPrimaryAction(
      {
        ...base,
        documents: [{ status: "INDEXED", updatedAt: new Date().toISOString() }],
        facts: [{ id: "f1" }],
        parties: [{ id: "p1" }],
        requests: [{ id: "r1" }],
        legalSources: [{ id: "l1" }],
        metadataJson: { strategy: { x: 1 } },
      },
      { draftBlocked: false },
    );
    expect(a.kind).toBe("post-draft");
  });

  it("com estratégia bloqueada redireciona para completar pendências", () => {
    const a = resolveCaseCockpitPrimaryAction(
      {
        ...base,
        documents: [{ status: "INDEXED", updatedAt: new Date().toISOString() }],
        facts: [{ id: "f1" }],
        parties: [{ id: "p1" }],
        requests: [{ id: "r1" }],
        legalSources: [{ id: "l1" }],
        metadataJson: { strategy: { x: 1 } },
      },
      { draftBlocked: true },
    );
    expect(a.kind).toBe("link");
    if (a.kind === "link") expect(a.label).toMatch(/pendências/i);
  });

  it("com peça sugere revisar", () => {
    const a = resolveCaseCockpitPrimaryAction(
      {
        ...base,
        documents: [{ status: "INDEXED", updatedAt: new Date().toISOString() }],
        facts: [{ id: "f1" }],
        parties: [{ id: "p1" }],
        requests: [{ id: "r1" }],
        legalSources: [{ id: "l1" }],
        drafts: [{ id: "d1" }],
        metadataJson: { strategy: { x: 1 } },
      },
      { draftBlocked: false },
    );
    expect(a.kind).toBe("post-review");
  });
});
