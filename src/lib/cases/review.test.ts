import { describe, expect, it } from "vitest";
import { CaseRequestKind } from "@prisma/client";
import { computeScore, runReview } from "./review";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";

// F6: peça "pronta para protocolo" agora exige nome das partes presente,
// pedidos classificados, sem placeholders e sem inconsistências documentais.
const fullDraft = `## I. Endereçamento
Excelentíssimo(a) Juiz(íza) de Direito.
## II. Qualificação das partes
Maria da Silva, brasileira, residente na Rua A.
## III. Dos fatos
01. Em 01/01/2026 a creche negou a vaga.
## IV. Do direito
Fundamentação normativa.
## V. Dos pedidos
Diante do exposto, requer a concessão da vaga.`;

const partialDraft = `## I. Endereçamento\n## V. Dos pedidos`;

const partyMaria = {
  id: "p1",
  caseId: "c",
  ordinal: 1,
  role: "AUTHOR",
  name: "Maria da Silva",
  document: "123",
  contact: null,
  metadataJson: null,
  createdAt: new Date(),
} as never;

describe("review", () => {
  it("score alto com peça completa, fundamentação, pedido principal e fatos", () => {
    const result = runReview({
      draftContent: fullDraft,
      groundingChunkIds: ["c1", "c2", "c3"],
      facts: [
        { id: "f1", caseId: "c", ordinal: 1, text: "x", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never,
        { id: "f2", caseId: "c", ordinal: 2, text: "y", category: null, dates: [], confidence: 0.7, createdAt: new Date() } as never,
      ],
      parties: [partyMaria],
      requests: [
        { id: "r1", caseId: "c", ordinal: 1, kind: CaseRequestKind.MAIN, text: "x", legalBasisUrn: null, metadataJson: null, createdAt: new Date() } as never,
      ],
      risks: [],
      issues: [],
      pinnedChunkIds: [],
      inconsistencyRisksCount: 0,
    });
    expect(result.score).toBeGreaterThan(0.85);
    expect(result.verdict).toMatch(/Pronta para protocolo|Quase pronta/);
    // F6: aceitamos que `urgency_consistency` ou outros checks venham como
    // pass; o importante é não haver fail.
    expect(result.items.every((i) => i.status !== "fail")).toBe(true);
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
    // F6: o verdict agora pode ser "Não-protocolável" quando há blockers
    // críticos; aceitamos qualquer verdict que indique gravidade.
    expect(result.verdict).toMatch(/N[ãa]o-protocol[áa]vel|Pend[êe]ncias cr[íi]ticas/);
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
