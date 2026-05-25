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
  type CaseParty,
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
  /** F6 — explicação para tooltip na UI (por que esse item virou warning/fail). */
  rationale?: string;
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
  /** F6 — partes do caso para validar qualificação. */
  parties?: CaseParty[];
  /** F6 — fontes pinadas (usadas como mustInclude no draft). */
  pinnedChunkIds?: string[];
  /** F6 — id da CaseRisk DOCUMENT_INCONSISTENCY (já persistidas). */
  inconsistencyRisksCount?: number;
  /** F6 — flag de uso do brain (vem do draft.metadataJson). */
  draftUsedBrain?: boolean;
};

export function runReview(args: ReviewArgs): ReviewResult {
  const items: ReviewItem[] = [];

  items.push(checkStructure(args.draftContent));
  items.push(checkGrounding(args.groundingChunkIds));
  items.push(checkAdctRelevance(args.draftContent));
  items.push(checkPlaceholders(args.draftContent));
  items.push(checkPartiesQualified(args.parties ?? [], args.draftContent));
  items.push(checkMainRequest(args.requests));
  items.push(checkRequestClassification(args.requests));
  items.push(checkUrgencyConsistency(args.requests, args.draftContent));
  items.push(checkFalseProtocolPromise(args.draftContent));
  items.push(checkFactsCoverage(args.facts));
  items.push(checkPinnedSourcesUsed(args.pinnedChunkIds ?? [], args.groundingChunkIds));
  items.push(checkConsistencyAlerts(args.inconsistencyRisksCount ?? 0));
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

/**
 * F8/F9 — ADCT irrelevante mina confiança e costuma ser um falso positivo de retrieval.
 * Heurística: se a minuta menciona ADCT/Disposições Transitórias, exige também
 * algum marcador mínimo de pertinência (transição, regra transitória).
 */
function checkAdctRelevance(content: string): ReviewItem {
  const mentionsAdct = /\bADCT\b/i.test(content) || /disposi[cç][oõ]es\s+transit[óo]rias/i.test(content);
  if (!mentionsAdct) {
    return {
      id: "adct_relevance",
      title: "Sem ADCT irrelevante",
      status: "pass",
      detail: "Minuta não menciona ADCT.",
      weight: 0.05,
    };
  }
  const hasContext = /transi[cç][aã]o|regra\s+transit[óo]ria|disposi[cç][oõ]es\s+transit[óo]rias/i.test(content);
  return {
    id: "adct_relevance",
    title: "ADCT só quando pertinente",
    status: hasContext ? "warning" : "fail",
    detail: hasContext
      ? "Minuta menciona ADCT — confirme se é realmente necessário ao caso."
      : "Minuta menciona ADCT sem contexto claro (risco de fundamento irrelevante).",
    rationale:
      "ADCT fora de contexto é um sinal típico de retrieval ruim. Se não houver regra transitória pertinente, remova ou substitua por fundamentos citáveis.",
    weight: 0.05,
  };
}

/**
 * F8/F9 — A minuta não pode prometer “pronta para protocolo” no próprio texto.
 * Isso confunde o usuário e viola a regra de revisão humana obrigatória.
 */
function checkFalseProtocolPromise(content: string): ReviewItem {
  const re = /\b(pronta|pronto)\s+para\s+protocolo\b/i;
  if (!re.test(content)) {
    return {
      id: "protocol_promise",
      title: "Sem promessa de protocolo",
      status: "pass",
      detail: "Minuta não contém promessa de protocolo no texto.",
      weight: 0.05,
    };
  }
  return {
    id: "protocol_promise",
    title: "Sem promessa de protocolo",
    status: "fail",
    detail: "Texto contém promessa de protocolo (remover).",
    rationale:
      "O JustOS não pode sugerir que a peça está pronta para protocolo sem revisão humana e sem checagens completas.",
    weight: 0.05,
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

/* ---------------------------- F6 checks --------------------------------- */

/**
 * F6.placeholders — peça com `[local]`, `[OAB]`, `_Lacuna:_` e similares
 * NÃO está pronta. Penaliza forte.
 */
function checkPlaceholders(content: string): ReviewItem {
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /\[local\]/i, label: "local da peça" },
    { re: /\[data\]/i, label: "data" },
    { re: /\[oab\]/i, label: "OAB" },
    { re: /\[nome do advogado\]/i, label: "nome do advogado" },
    { re: /_Partes a qualificar\._/i, label: "qualificação das partes" },
    { re: /_Pedidos a definir\._/i, label: "pedidos" },
    { re: /_Fatos a complementar\._/i, label: "fatos" },
    { re: /_Lacuna:/i, label: "valor da causa ou outra lacuna explícita" },
  ];
  const found = patterns.filter((p) => p.re.test(content));
  if (found.length === 0) {
    return {
      id: "placeholders",
      title: "Sem placeholders pendentes",
      status: "pass",
      detail: "Nenhum placeholder ou lacuna textual detectada.",
      weight: 0.12,
    };
  }
  return {
    id: "placeholders",
    title: "Placeholders / lacunas pendentes",
    status: found.length >= 3 ? "fail" : "warning",
    detail: `${found.length} placeholder(s) ainda na peça (${found.map((f) => f.label).join(", ")}).`,
    rationale:
      "Placeholders como [local], [OAB] ou seções 'a qualificar' indicam que a peça ainda não está pronta para protocolo.",
    weight: 0.12,
  };
}

/**
 * F6.parties_qualified — partes precisam ter ao menos 1 dado qualificador
 * (CPF/CNPJ ou endereço/identificação) refletido na peça.
 */
function checkPartiesQualified(parties: CaseParty[], content: string): ReviewItem {
  if (parties.length === 0) {
    return {
      id: "parties_qualified",
      title: "Partes qualificadas",
      status: "fail",
      detail: "Nenhuma parte cadastrada no caso.",
      rationale: "Sem partes registradas, a peça não pode endereçar autoria/legitimidade.",
      weight: 0.1,
    };
  }
  // Conta partes que aparecem qualificadas no texto (>= 1 token de doc/endereço/contato).
  let qualifiedInDraft = 0;
  for (const p of parties) {
    if (!p.name) continue;
    const re = new RegExp(escapeRegex(p.name), "i");
    if (!re.test(content)) continue;
    qualifiedInDraft++;
  }
  if (qualifiedInDraft === parties.length) {
    return {
      id: "parties_qualified",
      title: "Partes qualificadas",
      status: "pass",
      detail: `Todas as ${parties.length} parte(s) aparecem qualificadas na peça.`,
      weight: 0.1,
    };
  }
  if (qualifiedInDraft === 0) {
    return {
      id: "parties_qualified",
      title: "Partes qualificadas",
      status: "fail",
      detail: `Nenhuma das ${parties.length} parte(s) aparece nominalmente na peça.`,
      rationale:
        "Sem qualificação das partes na peça, não há autoria/citação válida — risco de inépcia.",
      weight: 0.1,
    };
  }
  return {
    id: "parties_qualified",
    title: "Partes qualificadas",
    status: "warning",
    detail: `${qualifiedInDraft} de ${parties.length} parte(s) aparecem na peça.`,
    rationale: "Algumas partes ainda não foram qualificadas no texto da peça.",
    weight: 0.1,
  };
}

/**
 * F6.request_classification — pedidos sem `kind` definido (todos em OTHER)
 * indicam que o intake/brain não classificou bem.
 */
function checkRequestClassification(reqs: CaseRequest[]): ReviewItem {
  if (reqs.length === 0) {
    return {
      id: "request_classification",
      title: "Classificação dos pedidos",
      status: "fail",
      detail: "Nenhum pedido cadastrado.",
      weight: 0.06,
    };
  }
  const classified = reqs.filter(
    (r) => r.kind && r.kind !== CaseRequestKind.OTHER,
  ).length;
  const ratio = classified / reqs.length;
  if (ratio >= 0.8) {
    return {
      id: "request_classification",
      title: "Classificação dos pedidos",
      status: "pass",
      detail: `${classified} de ${reqs.length} pedido(s) classificados (urgência/principal/etc).`,
      weight: 0.06,
    };
  }
  if (ratio >= 0.4) {
    return {
      id: "request_classification",
      title: "Classificação dos pedidos",
      status: "warning",
      detail: `Apenas ${classified} de ${reqs.length} pedido(s) classificados.`,
      rationale:
        "Pedidos sem categoria (urgência/principal/subsidiário) viram listas genéricas na peça.",
      weight: 0.06,
    };
  }
  return {
    id: "request_classification",
    title: "Classificação dos pedidos",
    status: "fail",
    detail: `${reqs.length - classified} pedido(s) sem categoria — peça vai mostrar 'OUTROS'.`,
    rationale:
      "Sem classificação correta, o renderRequests não consegue agrupar urgência vs. principal.",
    weight: 0.06,
  };
}

/**
 * F6.pinned_sources_used — quando há pinned sources, todas devem aparecer
 * em groundingChunkIds (foi assim que `mustInclude` foi desenhado).
 */
function checkPinnedSourcesUsed(pinned: string[], grounding: string[]): ReviewItem {
  if (pinned.length === 0) {
    return {
      id: "pinned_sources_used",
      title: "Fontes pinadas presentes na peça",
      status: "pass",
      detail: "Nenhuma fonte pinada — nada a checar.",
      weight: 0.05,
    };
  }
  const set = new Set(grounding);
  const used = pinned.filter((id) => set.has(id)).length;
  if (used === pinned.length) {
    return {
      id: "pinned_sources_used",
      title: "Fontes pinadas presentes na peça",
      status: "pass",
      detail: `Todas as ${pinned.length} fonte(s) pinada(s) foram usadas como fundamento.`,
      weight: 0.05,
    };
  }
  return {
    id: "pinned_sources_used",
    title: "Fontes pinadas presentes na peça",
    status: used === 0 ? "fail" : "warning",
    detail: `${used} de ${pinned.length} fonte(s) pinada(s) foi(ram) usada(s) na peça.`,
    rationale:
      "Fontes pinadas pelo advogado deveriam ter sido injetadas via mustInclude. Investigar por que ficaram fora.",
    weight: 0.05,
  };
}

/**
 * F6.consistency_alerts — peça gerada com alertas de inconsistência
 * documental ativos (DOCUMENT_INCONSISTENCY) precisa de revisão antes
 * de protocolo.
 */
function checkConsistencyAlerts(count: number): ReviewItem {
  if (count === 0) {
    return {
      id: "consistency_alerts",
      title: "Sem inconsistências documentais",
      status: "pass",
      detail: "Nenhum alerta de divergência entre brain e documentos.",
      weight: 0.06,
    };
  }
  return {
    id: "consistency_alerts",
    title: "Inconsistências documentais ativas",
    status: count >= 3 ? "fail" : "warning",
    detail: `${count} inconsistência(s) entre o caso e documentos não foram resolvidas.`,
    rationale:
      "CPFs, datas ou nomes divergentes podem invalidar a peça. Resolver na aba 'Documentos' ou ajustar o brain.",
    weight: 0.06,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/**
 * F6 — Verdict mais honesto. "Pronta para protocolo" exige TODOS os
 * critérios bloqueantes ok (placeholders/parties_qualified/grounding/
 * consistency_alerts), não apenas score >= 0.85.
 */
function deriveVerdict(score: number, items: ReviewItem[]): string {
  const fails = items.filter((i) => i.status === "fail");
  const warnings = items.filter((i) => i.status === "warning");
  const blockers = items.filter(
    (i) =>
      (i.id === "placeholders" ||
        i.id === "parties_qualified" ||
        i.id === "grounding" ||
        i.id === "adct_relevance" ||
        i.id === "protocol_promise" ||
        i.id === "consistency_alerts" ||
        i.id === "main_request") &&
      i.status === "fail",
  );

  if (blockers.length > 0) {
    return `Não-protocolável: ${blockers.length} bloqueante(s) crítico(s)`;
  }
  if (fails.length > 0) {
    return `Pendências críticas (${fails.length} fail / ${warnings.length} avisos)`;
  }
  if (score >= 0.9 && warnings.length === 0) {
    return "Pronta para protocolo";
  }
  if (score >= 0.85) {
    return `Quase pronta — ${warnings.length} aviso(s) para revisar`;
  }
  if (score >= 0.7) {
    return `Em revisão — ${warnings.length} aviso(s)`;
  }
  return "Em construção — revisão necessária";
}
