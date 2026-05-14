import { describe, expect, it } from "vitest";
import { buildPhases, computeProgressMetrics, getNextStepCallToAction } from "./case-progress-model";

const emptyCase = {
  documents: [] as { status: string }[],
  facts: [] as { id: string }[],
  parties: [] as { id: string }[],
  requests: [] as { id: string }[],
  legalSources: [] as { id: string }[],
  drafts: [] as { id: string }[],
  reviews: [] as { id: string }[],
  metadataJson: {},
};

describe("case-progress-model", () => {
  it("mantém 10 etapas em 4 fases", () => {
    const phases = buildPhases(emptyCase);
    expect(phases).toHaveLength(4);
    const total = phases.reduce((acc, p) => acc + p.steps.length, 0);
    expect(total).toBe(10);
  });

  it("marca documento enviado quando há documentos", () => {
    const phases = buildPhases({
      ...emptyCase,
      documents: [{ status: "UPLOADED" }],
    });
    const inicio = phases[0];
    expect(inicio).toBeDefined();
    const docStep = inicio!.steps.find((s) => s.label === "Documento enviado");
    expect(docStep?.status).toBe("done");
  });

  it("computa percentual e próximo passo", () => {
    const phases = buildPhases(emptyCase);
    const { doneCount, total, pct, nextStep } = computeProgressMetrics(phases);
    expect(total).toBe(10);
    expect(doneCount).toBeGreaterThanOrEqual(1);
    expect(pct).toBeGreaterThanOrEqual(10);
    expect(nextStep?.label).toBeDefined();
  });

  it("próximo passo usa tom imperativo (não o rótulo da etapa)", () => {
    const phases = buildPhases(emptyCase);
    const { nextStep } = computeProgressMetrics(phases);
    expect(nextStep?.label).toBe("Documento enviado");
    expect(getNextStepCallToAction(nextStep ?? null)).toBe("Enviar documento");
  });
});
