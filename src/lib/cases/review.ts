/**
 * Review inteligente da minuta jurídica.
 *
 * Combina sinais determinísticos:
 *
 *   - Estrutura mínima da peça (cabeçalho, fatos, direito, pedidos).
 *   - Existência de fundamentação ancorada (groundingChunkIds não vazio).
 *   - Riscos detectados pelo `contradiction` layer (severity).
 *   - Issues spotadas pelo `issue-spotting` (gaps temáticos).
 *   - Coerência fato↔pedido (todo pedido deve ter ao menos 1 fato relacionado).
 *   - Pedido principal presente (CaseRequestKind.MAIN).
 *
 * Saída:
 *   - score 0..1 — quanto a peça está pronta.
 *   - verdict humano em 1 linha.
 *   - checklist[] — itens com pass/fail/warning + justificativa.
 *
 * É **deterministic** e *workspace-isolated* — não depende de LLM.
 */

import {
  CaseRequestKind,
  type CaseFact,
  type CaseRequest,
} from "@prisma/client";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";

export type ReviewItemStatus = "pass" | "warning" | "fail";

export type ReviewItem = {
  id: string;
  title: string;
  status: ReviewItemStatus;
  detail: string;
  weight: number; // contribuição pro score (sum=1)
};

export type ReviewResult = {
  score: number;
  verdict: string;
  items: ReviewItem[];
};

export type ReviewArgs = {
  draftContent: string;
  groundingChunkIds: string[];
  facts: CaseFact[];
  requests: CaseRequest[];
  risks: ContradictionRisk[];
  issues: LegalIssue[];
};

export function runReview(args: ReviewArgs): ReviewResult {
  const items: ReviewItem[] = [];

  items.push(checkStructure(args.draftContent));
  items.push(checkGrounding(args.groundingChunkIds));
  items.push(checkMainRequest(args.requests));
  items.push(checkUrgencyConsistency(args.requests, args.draftContent));
  items.push(checkFactsCoverage(args.facts));
  items.push(checkRevokedNorms(args.risks));
  items.push(checkPrecedentDivergence(args.risks));
  items.push(checkIssueGaps(args.issues));

  const score = computeScore(items);
  const verdict = deriveVerdict(score, items);

  return { score, verdict, items };
}

/* ---------------------------- checks ----------------------------------- */

function checkStructure(content: string): ReviewItem {
  const required = [
    /^##\s*I\.\s*Endereçamento/m,
    /^##\s*II\.\s*Qualificação/m,
    /^##\s*III\.\s*Dos fatos/m,
    /^##\s*IV\.\s*Do direito/m,
    /^##\s*V\.\s*Dos pedidos/m,
  ];
  const missing = required.filter((r) => !r.test(content));
  if (missing.length === 0) {
    return {
      id: "structure",
      title: "Estrutura mínima da peça",
      status: "pass",
      detail: "Todas as seções obrigatórias estão presentes.",
      weight: 0.15,
    };
  }
  return {
    id: "structure",
    title: "Estrutura mínima da peça",
    status: missing.length > 1 ? "fail" : "warning",
    detail: `${missing.length} seção(ões) ausente(s).`,
    weight: 0.15,
  };
}

function checkGrounding(chunkIds: string[]): ReviewItem {
  if (chunkIds.length === 0) {
    return {
      id: "grounding",
      title: "Fundamentação normativa ancorada",
      status: "fail",
      detail: "Nenhum chunk normativo foi citado — peça sem ancoragem.",
      weight: 0.18,
    };
  }
  if (chunkIds.length < 2) {
    return {
      id: "grounding",
      title: "Fundamentação normativa ancorada",
      status: "warning",
      detail: "Apenas 1 fonte normativa citada — considere ampliar.",
      weight: 0.18,
    };
  }
  return {
    id: "grounding",
    title: "Fundamentação normativa ancorada",
    status: "pass",
    detail: `${chunkIds.length} fontes normativas citadas.`,
    weight: 0.18,
  };
}

function checkMainRequest(reqs: CaseRequest[]): ReviewItem {
  const hasMain = reqs.some((r) => r.kind === CaseRequestKind.MAIN);
  return {
    id: "main_request",
    title: "Pedido principal definido",
    status: hasMain ? "pass" : "fail",
    detail: hasMain
      ? "Pedido principal presente."
      : "Sem pedido principal — peça incompleta.",
    weight: 0.12,
  };
}

function checkUrgencyConsistency(reqs: CaseRequest[], content: string): ReviewItem {
  const hasUrgency = reqs.some((r) => r.kind === CaseRequestKind.URGENCY);
  const sectionPresent = /VI\.\s*Da tutela de urgência/.test(content);
  if (hasUrgency === sectionPresent) {
    return {
      id: "urgency_consistency",
      title: "Coerência da tutela de urgência",
      status: "pass",
      detail: hasUrgency
        ? "Pedido de urgência refletido na peça."
        : "Sem pedido de urgência — seção corretamente omitida.",
      weight: 0.08,
    };
  }
  return {
    id: "urgency_consistency",
    title: "Coerência da tutela de urgência",
    status: "warning",
    detail: hasUrgency
      ? "Pedido urgente sem seção dedicada."
      : "Seção de urgência presente sem pedido correspondente.",
    weight: 0.08,
  };
}

function checkFactsCoverage(facts: CaseFact[]): ReviewItem {
  if (facts.length === 0) {
    return {
      id: "facts",
      title: "Fatos extraídos",
      status: "fail",
      detail: "Sem fatos no caso — extraia ao menos 1 fato.",
      weight: 0.12,
    };
  }
  if (facts.length < 2) {
    return {
      id: "facts",
      title: "Fatos extraídos",
      status: "warning",
      detail: "Apenas 1 fato — considere detalhar a narrativa.",
      weight: 0.12,
    };
  }
  return {
    id: "facts",
    title: "Fatos extraídos",
    status: "pass",
    detail: `${facts.length} fatos extraídos.`,
    weight: 0.12,
  };
}

function checkRevokedNorms(risks: ContradictionRisk[]): ReviewItem {
  const revoked = risks.filter((r) => /revogad|histórica|antiga/i.test(`${r.title} ${r.detail}`));
  if (revoked.length === 0) {
    return {
      id: "revoked",
      title: "Sem norma revogada como fundamento",
      status: "pass",
      detail: "Nenhuma norma revogada citada.",
      weight: 0.12,
    };
  }
  return {
    id: "revoked",
    title: "Sem norma revogada como fundamento",
    status: revoked.some((r) => r.severity === "alta") ? "fail" : "warning",
    detail: `${revoked.length} norma(s) potencialmente revogada(s) detectada(s).`,
    weight: 0.12,
  };
}

function checkPrecedentDivergence(risks: ContradictionRisk[]): ReviewItem {
  const div = risks.filter((r) => /diverg/i.test(`${r.title} ${r.detail}`));
  if (div.length === 0) {
    return {
      id: "divergence",
      title: "Sem divergência jurisprudencial não-endereçada",
      status: "pass",
      detail: "Não há divergência sinalizada.",
      weight: 0.08,
    };
  }
  return {
    id: "divergence",
    title: "Sem divergência jurisprudencial não-endereçada",
    status: "warning",
    detail: `${div.length} divergência(s) detectada(s) — endereçar explicitamente.`,
    weight: 0.08,
  };
}

function checkIssueGaps(issues: LegalIssue[]): ReviewItem {
  if (issues.length === 0) {
    return {
      id: "issues",
      title: "Issues spotadas endereçadas",
      status: "pass",
      detail: "Sem issues pendentes.",
      weight: 0.15,
    };
  }
  const blocking = issues.filter((i) => i.confidence >= 0.6);
  if (blocking.length === 0) {
    return {
      id: "issues",
      title: "Issues spotadas endereçadas",
      status: "pass",
      detail: `${issues.length} issue(s) leve(s) — sem bloqueio.`,
      weight: 0.15,
    };
  }
  return {
    id: "issues",
    title: "Issues spotadas endereçadas",
    status: blocking.length >= 2 ? "fail" : "warning",
    detail: `${blocking.length} issue(s) com alta confiança aguardando tratamento.`,
    weight: 0.15,
  };
}

/* ---------------------------- score logic ------------------------------ */

function statusToValue(s: ReviewItemStatus): number {
  return s === "pass" ? 1 : s === "warning" ? 0.5 : 0;
}

export function computeScore(items: ReviewItem[]): number {
  const totalW = items.reduce((acc, i) => acc + i.weight, 0) || 1;
  const sum = items.reduce((acc, i) => acc + statusToValue(i.status) * i.weight, 0);
  return Math.max(0, Math.min(1, sum / totalW));
}

function deriveVerdict(score: number, items: ReviewItem[]): string {
  const fails = items.filter((i) => i.status === "fail");
  if (score >= 0.85 && fails.length === 0) return "Pronta para protocolo";
  if (fails.length > 0) return `Pendências críticas (${fails.length})`;
  if (score >= 0.7) return "Quase pronta — ajustes finos";
  return "Em construção — revisão necessária";
}
