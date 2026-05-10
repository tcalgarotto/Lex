import { describe, expect, it } from "vitest";
import {
  legalResearchMarkVerifiedBodySchema,
  legalResearchPinBodySchema,
  legalResearchSearchBodySchema,
} from "@/lib/legal-research/request-body";

describe("legal research request schemas", () => {
  it("accepts search payload without caseId", () => {
    const p = legalResearchSearchBodySchema.safeParse({
      query: "dano moral",
      resultTypes: ["LAW"],
    });
    expect(p.success).toBe(true);
  });

  it("accepts pin with full foundation object", () => {
    const p = legalResearchPinBodySchema.safeParse({
      caseId: "case_1",
      foundation: {
        id: "cand-1",
        title: "Lei X",
        citation: "Lei 1/2000",
        excerpt: "Texto",
        legalIssue: "tema",
        whyRelevant: "a",
        suggestedUse: "b",
        confidence: 0.5,
        verificationStatus: "AI_RECOMMENDED_UNVERIFIED",
        warnings: [],
        type: "LAW",
      },
    });
    expect(p.success).toBe(true);
  });

  it("rejects pin without foundation or jurisprudence", () => {
    const p = legalResearchPinBodySchema.safeParse({ caseId: "c1" });
    expect(p.success).toBe(false);
  });

  it("accepts mark-verified with pinnedId", () => {
    const p = legalResearchMarkVerifiedBodySchema.safeParse({
      caseId: "case_1",
      pinnedId: "pin_1",
      kind: "foundation",
    });
    expect(p.success).toBe(true);
  });
});
