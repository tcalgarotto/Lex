import { describe, expect, it } from "vitest";
import {
  buildCaseDisplaySnapshot,
  compactContextPayload,
  pickStructuredSource,
} from "@/lib/cases/intake/case-intake-context";
import { createDefaultFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";

describe("case-intake-context", () => {
  it("compactContextPayload remove vazios e trunca strings", () => {
    const out = compactContextPayload({
      a: "",
      b: "ok",
      c: "x".repeat(10_000),
    }, { maxStringLength: 100 });
    expect(out).toEqual({ b: "ok", c: `${"x".repeat(100)}…` });
  });

  it("buildCaseDisplaySnapshot deriva partes e fatos do intakeForm", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "Maria Silva";
    form.narrative.whatHappened = "Inadimplemento contratual.";
    form.goals.clientWants = "Receber indenização.";

    const display = buildCaseDisplaySnapshot({
      metadataJson: { intakeForm: form, intakeFormSource: "intake_form" },
    });

    expect(display?.source).toBe("intake_form");
    expect(display?.parties.some((p) => p.name.includes("Maria"))).toBe(true);
    expect(display?.facts.some((f) => f.text.includes("Inadimplemento"))).toBe(true);
    expect(display?.requests[0]?.text).toContain("indenização");
  });

  it("pickStructuredSource prefere brain com conteúdo", () => {
    const src = pickStructuredSource({
      snap: {
        parties: [{ id: "1", role: "AUTHOR", kind: "PERSON", name: "A", document: null, metadataJson: {}, origem: null, status: null, lockedByUser: false }],
        facts: [],
        claims: [],
        risks: [],
        brain: { parties: [], facts: [], requests: [], risks: [], narrative: "", objective: "", brainVersion: 1 },
      } as never,
      intakeForm: createDefaultFundamentalIntakeForm(),
    });
    expect(src).toBe("relational");
  });
});
