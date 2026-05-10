import { describe, expect, it } from "vitest";
import { legalResearchPinBodySchema } from "@/lib/legal-research/request-body";

/**
 * Smoke de contratos usados no fluxo caso → pesquisa → pin.
 * Fluxo E2E completo (DB + auth) fica em `tests/integration` / Playwright — ver relatório P0.
 */
describe("case legal flow contracts", () => {
  it("pin accepts assisted foundation shape from research UI", () => {
    const parsed = legalResearchPinBodySchema.safeParse({
      caseId: "case_test",
      foundation: {
        id: "lf-1",
        type: "LAW",
        title: "Fundamento teste",
        citation: "CF/1988",
        excerpt: "Trecho sugerido.",
        legalIssue: "tema",
        whyRelevant: "motivo",
        suggestedUse: "uso",
        confidence: 0.6,
        verificationStatus: "AI_RECOMMENDED_UNVERIFIED",
        warnings: ["Sem URL oficial"],
      },
    });
    expect(parsed.success).toBe(true);
  });
});
