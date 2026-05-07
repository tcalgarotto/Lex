import { describe, expect, it } from "vitest";
import { buildReasoningTree } from "./explain-tree";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";
import type { LegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievalTrace } from "@/lib/retrieval/legal/types";

describe("explain-tree", () => {
  it("monta árvore com filhos principais", () => {
    const intent = {
      classification: { queryType: "research" },
      tribunals: ["TJSP"],
      preferredKinds: [],
    } as unknown as LegalIntent;

    const trace: LegalRetrievalTrace = {
      traceId: "trace-uuid-full-string-here",
      totalLatencyMs: 120,
      stages: [{ stage: "classify-intent", latencyMs: 5 }],
      candidates: { dense: 1, bm25: 1, afterFusion: 1, afterGraph: 1, afterRerank: 1, final: 1 },
    };

    const strategy: StrategySynthesis = {
      thesis: "Tese",
      arguments: [
        {
          id: "a1",
          headline: "Arg",
          excerpt: "ex",
          evidence: { chunkIds: [], normUrns: [] },
          weight: 0.9,
        },
      ],
      counterArguments: [],
      nextSteps: [],
      badge: "b",
    };

    const tree = buildReasoningTree({
      query: "teste de consulta",
      intent,
      trace,
      issues: [] as LegalIssue[],
      risks: [] as ContradictionRisk[],
      strategy,
    });

    expect(tree.children?.length).toBeGreaterThanOrEqual(4);
    expect(tree.children?.some((c) => c.id === "intent")).toBe(true);
    expect(tree.children?.some((c) => c.id === "arguments")).toBe(true);
  });
});
