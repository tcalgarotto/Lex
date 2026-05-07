import { describe, expect, it } from "vitest";
import { CaseRequestKind } from "@prisma/client";
import { computeScore, runReview } from "./review";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";

const fullDraft = `## I. Endereçamento
foo
## II. Qualificação das partes
bar
## III. Dos fatos
baz
## IV. Do direito
qux
## V. Dos pedidos
quux`;

const partialDraft = `## I. Endereçamento\n## V. Dos pedidos`;

describe("review", () => {
  it("score alto com peça completa, fundamentação, pedido principal e fatos", () => {
    const result = runReview({
      draftContent: fullDraft,
      groundingChunkIds: ["c1", "c2", "c3"],
      facts: [
        { id: "f1", caseId: "c", ordinal: 1, text: "x", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never,
        { id: "f2", caseId: "c", ordinal: 2, text: "y", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never,
      ],
      requests: [
        { id: "r1", caseId: "c", ordinal: 1, kind: CaseRequestKind.MAIN, text: "x", legalBasisUrn: null, metadataJson: null, createdAt: new Date() } as never,
      ],
      risks: [],
      issues: [],
    });
    expect(result.score).toBeGreaterThan(0.85);
    expect(result.verdict).toBe("Pronta para protocolo");
    expect(result.items.every((i) => i.status === "pass")).toBe(true);
  });

  it("score baixo quando estrutura está incompleta + sem grounding", () => {
    const result = runReview({
      draftContent: partialDraft,
      groundingChunkIds: [],
      facts: [],
      requests: [],
      risks: [],
      issues: [],
    });
    expect(result.score).toBeLessThan(0.5);
    expect(result.verdict).toContain("Pendências críticas");
  });

  it("aponta norma revogada como warning/fail", () => {
    const risks: ContradictionRisk[] = [
      { id: "r1", severity: "alta", title: "Norma revogada", detail: "Foi expressamente revogada.", evidence: { chunkIds: [], normUrns: [] } },
    ];
    const result = runReview({
      draftContent: fullDraft,
      groundingChunkIds: ["c1"],
      facts: [{ id: "f1", caseId: "c", ordinal: 1, text: "x", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never],
      requests: [{ id: "r1", caseId: "c", ordinal: 1, kind: CaseRequestKind.MAIN, text: "x", legalBasisUrn: null, metadataJson: null, createdAt: new Date() } as never],
      risks,
      issues: [],
    });
    const item = result.items.find((i) => i.id === "revoked")!;
    expect(item.status).toBe("fail");
  });

  it("issues alta confiança rebaixam o score", () => {
    const issues: LegalIssue[] = [
      { id: "issue-prescricao", title: "Prescrição/decadência", description: "...", category: "prescricao-decadencia", confidence: 0.9, evidence: { chunkIds: [] }, rationale: "..." } as never,
      { id: "issue-onus", title: "Ônus probatório", description: "...", category: "onus", confidence: 0.7, evidence: { chunkIds: [] }, rationale: "..." } as never,
    ];
    const result = runReview({
      draftContent: fullDraft,
      groundingChunkIds: ["c1", "c2"],
      facts: [
        { id: "f1", caseId: "c", ordinal: 1, text: "x", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never,
        { id: "f2", caseId: "c", ordinal: 2, text: "y", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never,
      ],
      requests: [{ id: "r1", caseId: "c", ordinal: 1, kind: CaseRequestKind.MAIN, text: "x", legalBasisUrn: null, metadataJson: null, createdAt: new Date() } as never],
      risks: [],
      issues,
    });
    const item = result.items.find((i) => i.id === "issues")!;
    expect(item.status).toBe("fail");
    expect(result.score).toBeLessThan(0.9);
  });

  it("computeScore funciona com items vazios (defesa)", () => {
    expect(computeScore([])).toBe(0);
  });

  it("urgência presente exige seção VI no draft", () => {
    const r = runReview({
      draftContent: fullDraft, // sem VI
      groundingChunkIds: ["c1", "c2"],
      facts: [{ id: "f1", caseId: "c", ordinal: 1, text: "x", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never],
      requests: [
        { id: "r1", caseId: "c", ordinal: 1, kind: CaseRequestKind.MAIN, text: "x", legalBasisUrn: null, metadataJson: null, createdAt: new Date() } as never,
        { id: "r2", caseId: "c", ordinal: 2, kind: CaseRequestKind.URGENCY, text: "tutela", legalBasisUrn: null, metadataJson: null, createdAt: new Date() } as never,
      ],
      risks: [],
      issues: [],
    });
    const item = r.items.find((i) => i.id === "urgency_consistency")!;
    expect(item.status).toBe("warning");
  });
});
