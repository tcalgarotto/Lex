/**
 * Árvore de raciocínio explicável — estrutura hierárquica para UI (sem LLM).
 */

import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";
import type { LegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievalTrace } from "@/lib/retrieval/legal/types";

export type ReasoningTreeNode = {
  id: string;
  label: string;
  detail?: string;
  strength?: number;
  children?: ReasoningTreeNode[];
};

export function buildReasoningTree(args: {
  query: string;
  intent: LegalIntent;
  trace: LegalRetrievalTrace;
  issues: LegalIssue[];
  risks: ContradictionRisk[];
  strategy: StrategySynthesis;
}): ReasoningTreeNode {
  const intentNode: ReasoningTreeNode = {
    id: "intent",
    label: "Intent jurídico",
    detail: args.intent.classification.queryType,
    children: [
      {
        id: "intent-tribunals",
        label: "Tribunais detectados",
        detail: args.intent.tribunals.join(", ") || "(nenhum)",
      },
      {
        id: "intent-kinds",
        label: "Âmbito normativo preferido",
        detail: args.intent.preferredKinds.slice(0, 4).join(", ") || "(inferido do texto)",
      },
    ],
  };

  const retrievalNode: ReasoningTreeNode = {
    id: "retrieval",
    label: "Pipeline de retrieval",
    detail: `trace ${args.trace.traceId.slice(0, 8)} · ${args.trace.totalLatencyMs}ms`,
    children: args.trace.stages.map((s) => ({
      id: `stage-${s.stage}`,
      label: s.stage,
      detail: `${s.latencyMs}ms`,
    })),
  };

  const issueNodes: ReasoningTreeNode = {
    id: "issues",
    label: `Issues (${args.issues.length})`,
    children: args.issues.slice(0, 8).map((i) => ({
      id: `issue-${i.id}`,
      label: i.title,
      detail: i.rationale.slice(0, 160),
      strength: i.confidence,
    })),
  };

  const riskNodes: ReasoningTreeNode = {
    id: "risks",
    label: `Riscos (${args.risks.length})`,
    children: args.risks.slice(0, 8).map((r) => ({
      id: `risk-${r.id}`,
      label: r.title,
      detail: r.detail.slice(0, 160),
      strength: r.severity === "alta" ? 1 : r.severity === "media" ? 0.6 : 0.3,
    })),
  };

  const argsNodes: ReasoningTreeNode = {
    id: "arguments",
    label: "Força argumentativa",
    children: args.strategy.arguments.map((a) => ({
      id: a.id,
      label: a.headline,
      detail: a.excerpt.slice(0, 140),
      strength: a.weight,
    })),
  };

  return {
    id: "root",
    label: `Consulta: ${args.query.slice(0, 80)}${args.query.length > 80 ? "…" : ""}`,
    children: [intentNode, retrievalNode, issueNodes, riskNodes, argsNodes],
  };
}
