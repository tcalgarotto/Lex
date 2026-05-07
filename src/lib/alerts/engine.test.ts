import { describe, expect, it } from "vitest";
import { CaseAlertKind, CaseAlertSeverity } from "@prisma/client";
import { deriveAlerts } from "./engine";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";

const baseRisk: ContradictionRisk = {
  id: "r1",
  title: "Norma revogada citada",
  detail: "O art. X da Lei Y foi revogado em 2020.",
  severity: "alta",
  evidence: { chunkIds: ["ch1"], normUrns: ["urn:lex:br:federal:lei:2010-01-01;1234"] },
};

describe("deriveAlerts", () => {
  it("classifica risco com 'revogad' como NORM_REVOKED + HIGH", () => {
    const out = deriveAlerts({ risks: [baseRisk], issues: [] });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe(CaseAlertKind.NORM_REVOKED);
    expect(out[0]!.severity).toBe(CaseAlertSeverity.HIGH);
    expect(out[0]!.reference).toBe("urn:lex:br:federal:lei:2010-01-01;1234");
  });

  it("classifica risco com 'diverg' como PRECEDENT_DIVERGENCE", () => {
    const out = deriveAlerts({
      risks: [{ ...baseRisk, title: "Divergência entre turmas", detail: "Há divergência jurisprudencial." }],
      issues: [],
    });
    expect(out[0]!.kind).toBe(CaseAlertKind.PRECEDENT_DIVERGENCE);
  });

  it("emite STRATEGIC_HISTORY quando 5+ issues", () => {
    const issues = Array.from({ length: 5 }).map(
      (_, i) =>
        ({
          id: `i-${i}`,
          title: `issue ${i}`,
          category: "civil",
        }) as unknown as LegalIssue,
    );
    const out = deriveAlerts({ risks: [], issues });
    expect(out.some((a) => a.kind === CaseAlertKind.STRATEGIC_HISTORY)).toBe(true);
  });

  it("dispara RISING_RISK quando grounding cai >= 0.15", () => {
    const out = deriveAlerts({
      risks: [],
      issues: [],
      previousGroundingScore: 0.8,
      groundingScore: 0.6,
    });
    expect(out.some((a) => a.kind === CaseAlertKind.RISING_RISK && a.severity === CaseAlertSeverity.HIGH)).toBe(true);
  });

  it("não dispara RISING_RISK em queda menor", () => {
    const out = deriveAlerts({ risks: [], issues: [], previousGroundingScore: 0.8, groundingScore: 0.72 });
    expect(out.find((a) => a.kind === CaseAlertKind.RISING_RISK)).toBeUndefined();
  });
});
