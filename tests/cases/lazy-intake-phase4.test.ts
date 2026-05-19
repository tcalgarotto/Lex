import { describe, expect, it } from "vitest";
import {
  buildCaseDisplaySnapshot,
  formatCaseTaskContextForPrompt,
  pickStructuredSource,
} from "@/lib/cases/intake/case-intake-context";
import { createDefaultFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { runDraftingGuard } from "@/lib/cases/drafting/drafting-guard";
import type { CaseBrainSnapshot } from "@/lib/cases/case-brain/snapshot";

describe("Lazy intake P0.2 — Fase 4", () => {
  it("pickStructuredSource ignora brain vazio e usa intake_form", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "João";
    const snap = {
      brain: {
        parties: [],
        facts: [],
        requests: [],
        risks: [],
        narrative: "",
        objective: "",
        brainVersion: 1,
      },
      parties: [],
      facts: [],
      claims: [],
    } as unknown as CaseBrainSnapshot;

    expect(pickStructuredSource({ snap, intakeForm: form })).toBe("intake_form");
  });

  it("pickStructuredSource prefere brain com conteúdo", () => {
    const snap = {
      brain: {
        parties: [{ role: "assisted_party", name: "Maria", sourceText: "", confidence: 1, origin: "input" }],
        facts: [],
        requests: [],
        risks: [],
        narrative: "texto",
        objective: "obj",
        brainVersion: 1,
      },
      parties: [],
      facts: [],
      claims: [],
    } as unknown as CaseBrainSnapshot;

    expect(pickStructuredSource({ snap, intakeForm: null })).toBe("brain");
  });

  it("formatCaseTaskContextForPrompt não inclui JSON bruto da entrevista", () => {
    const ctx = {
      legalArea: "Consumidor",
      facts: "Fato relevante do caso.",
      requests: "Indenização.",
    };
    const text = formatCaseTaskContextForPrompt(ctx);
    expect(text).toContain("legalArea");
    expect(text).toContain("Fato relevante");
    expect(text).not.toContain("intakeForm");
  });

  it("buildCaseDisplaySnapshot deriva dados para caso não organizado", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.narrative.whatHappened = "Relato principal.";
    const display = buildCaseDisplaySnapshot({
      metadataJson: { intakeForm: form, intakeFormSource: "intake_form" },
    });
    expect(display?.source).toBe("intake_form");
    expect(display?.facts.length).toBeGreaterThan(0);
  });

  it("drafting-guard aceita partes/fatos da entrevista derivada", () => {
    const form = createDefaultFundamentalIntakeForm();
    form.clientPerson!.fullName = "Cliente Teste";
    form.narrative.whatHappened = "Fato da entrevista.";
    const display = buildCaseDisplaySnapshot({
      metadataJson: { intakeForm: form },
    });

    const guard = runDraftingGuard({
      snapshot: {
        brain: null,
        parties: [],
        facts: [],
        requests: [],
        risks: [],
        documents: [],
      },
      intakeDisplay: display,
      pinnedFoundations: [
        {
          id: "p1",
          chunkId: "c",
          normUrn: null,
          articleRef: null,
          excerpt: "trecho",
          verificationStatus: "USER_VERIFIED",
          title: "CDC",
          citation: "Lei 8.078/90",
        },
      ],
      jurisprudenceCandidates: [],
      draftingStrategyExists: true,
      draftingStrategyApproved: true,
    });

    expect(guard.ok).toBe(true);
  });

  it("recommend route usa buildCaseTaskContext", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(__dirname, "../../src/app/api/legal-research/recommend-for-case/route.ts"),
      "utf-8",
    );
    expect(src).toMatch(/buildCaseTaskContext/);
    expect(src).toMatch(/formatCaseTaskContextForPrompt/);
    expect(src).not.toMatch(/getCaseBrainSnapshot/);
  });

  it("generate-strategy usa buildCaseTaskContext", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(__dirname, "../../src/lib/cases/drafting/generate-strategy.ts"),
      "utf-8",
    );
    expect(src).toMatch(/buildCaseTaskContext/);
    expect(src).toMatch(/NÃO redija peça processual completa/);
  });
});
