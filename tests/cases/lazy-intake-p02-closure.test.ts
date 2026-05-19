import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDraftingPartiesFactsPreview } from "@/lib/cases/drafting/drafting-guard";
import type { CaseDisplaySnapshot } from "@/lib/cases/intake/case-intake-context";

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, "../../src/app/api/cases/fundamental-intake/route.ts"),
  "utf-8",
);

describe("Lazy intake P0.2 — fechamento", () => {
  it("API: reorganize flag e action=reorganize; sem 409 para caso já organizado", () => {
    expect(ROUTE).toMatch(/reorganize/);
    expect(ROUTE).toMatch(/REORGANIZE_REQUIRED/);
    expect(ROUTE).not.toMatch(/status:\s*409/);
    expect(ROUTE).toMatch(/wantsReorganize/);
  });

  it("UI entrevista: formulário embutido também quando já organizado", () => {
    const p = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/(app)/cases/[id]/entrevista/page.tsx"),
      "utf-8",
    );
    expect(p).toMatch(/intakeAlreadyOrganized=\{structured\}/);
    expect(p).not.toMatch(/já foi estruturada/);
  });

  it("bootstrap expõe hasAuthor/hasFact alinhados ao intake derivado", () => {
    const b = fs.readFileSync(
      path.resolve(__dirname, "../../src/lib/cases/case-bootstrap.ts"),
      "utf-8",
    );
    expect(b).toMatch(/resolveDraftingPartiesFactsPreview/);
    expect(b).toMatch(/hasAuthor: partiesFacts\.hasAuthor/);
    expect(b).toMatch(/hasFact: partiesFacts\.hasFact/);
  });

  it("resolveDraftingPartiesFactsPreview: autor/fato da entrevista sem CaseParty/CaseFact", () => {
    const intakeDisplay: CaseDisplaySnapshot = {
      source: "intake_form",
      parties: [{ role: "Autor / cliente", name: "Maria" }],
      facts: [{ text: "Inadimplemento contratual" }],
      requests: [],
      risks: [],
      gaps: [],
      legalArea: null,
      clientObjective: null,
    };
    const r = resolveDraftingPartiesFactsPreview({
      parties: [],
      facts: [],
      intakeDisplay,
    });
    expect(r.hasAuthor).toBe(true);
    expect(r.hasFact).toBe(true);
  });
});
