import { describe, expect, it } from "vitest";
import { legalResearchRecommendBodySchema } from "@/lib/legal-research/request-body";

/**
 * Contratos de payload: workspace explícito divergente deve falhar na rota (403).
 * Aqui validamos apenas que o schema permite workspaceId opcional para o handler comparar.
 */
describe("case / workspace contracts (static)", () => {
  it("recommend schema requires caseId", () => {
    const bad = legalResearchRecommendBodySchema.safeParse({
      query: "x",
      resultTypes: ["LAW"],
    });
    expect(bad.success).toBe(false);
  });

  it("recommend schema accepts case-bound request", () => {
    const ok = legalResearchRecommendBodySchema.safeParse({
      caseId: "c1",
      query: "tema",
      resultTypes: ["LAW", "JURISPRUDENCE"],
    });
    expect(ok.success).toBe(true);
  });
});
