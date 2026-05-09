/**
 * Calculadora de prontidão processual (F2.2).
 *
 * Score 0..100 baseado em sinais auditáveis do brain + checklist + docs.
 * Status faixas: <40 insuficiente, 40-69 parcial, 70-89 boa, ≥90 pronta.
 *
 * Cada checklist (F2.1) pode plugar regras específicas via
 * `getChecklistReadinessRules(templateId)` — fallback genérico cobre
 * casos sem checklist.
 */

import type {
  BrainAuthority,
  BrainEvidence,
  BrainFact,
  BrainParty,
  BrainRequest,
  ChecklistResponses,
  ProceduralReadiness,
  ProceduralReadinessStatus,
} from "./brain-types";

export type ReadinessRule = {
  id: string;
  label: string;
  weight: number;
  /** True quando a regra é satisfeita pelo brain/checklist/documents. */
  isSatisfied: (ctx: ReadinessContext) => boolean;
  /** True se a falha desta regra deve travar a peça (blocker crítico). */
  blocker?: boolean;
  /** Frase humana usada como `nextBestAction` quando esta é a regra de maior peso ainda em aberto. */
  nextActionHint?: string;
};

export type ReadinessContext = {
  parties: BrainParty[];
  facts: BrainFact[];
  requests: BrainRequest[];
  evidence: BrainEvidence[];
  probableAuthority?: BrainAuthority | undefined;
  missingDocuments: string[];
  checklistResponses?: ChecklistResponses | undefined;
  documents: Array<{ id: string; originalName: string }>;
  area: string[];
};

export function computeProceduralReadiness(ctx: ReadinessContext): ProceduralReadiness {
  const rules = pickRulesForCase(ctx);
  const totalWeight = rules.reduce((acc, r) => acc + r.weight, 0);
  let earned = 0;
  const blockers: string[] = [];
  const unmet: ReadinessRule[] = [];

  for (const rule of rules) {
    const ok = rule.isSatisfied(ctx);
    if (ok) {
      earned += rule.weight;
    } else {
      unmet.push(rule);
      if (rule.blocker) blockers.push(rule.label);
    }
  }

  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  const status = decideStatus(score, blockers.length);
  const nextBestAction = buildNextBestAction(unmet, ctx);
  const rationale = buildRationale(rules, ctx);

  return {
    score,
    status,
    blockers,
    missingDocuments: dedupeStrings([
      ...ctx.missingDocuments,
      ...inferMissingFromRules(unmet),
    ]),
    nextBestAction,
    rationale,
  };
}

function decideStatus(score: number, blockers: number): ProceduralReadinessStatus {
  // Blocker crítico em aberto sempre derruba para "insuficiente" no mínimo.
  if (blockers > 0 && score < 70) return "insuficiente";
  if (score < 40) return "insuficiente";
  if (score < 70) return "parcial";
  if (score < 90) return "boa";
  return "pronta_para_minuta";
}

function buildNextBestAction(unmet: ReadinessRule[], ctx: ReadinessContext): string {
  const blockerFirst = [...unmet].sort((a, b) => {
    if (a.blocker && !b.blocker) return -1;
    if (!a.blocker && b.blocker) return 1;
    return b.weight - a.weight;
  });
  const top = blockerFirst[0];
  if (!top) {
    return "Caso pronto. Revise a peça gerada antes do protocolo.";
  }
  if (top.nextActionHint) return top.nextActionHint;
  return `Resolver: ${top.label}.`;

  // ctx mantido na assinatura para futuras regras dependentes do contexto
  void ctx;
}

function buildRationale(rules: ReadinessRule[], ctx: ReadinessContext): string {
  const ok = rules.filter((r) => r.isSatisfied(ctx)).length;
  return `${ok}/${rules.length} critérios satisfeitos. Status calculado a partir de partes, fatos, pedidos, evidências e prontidão documental.`;
}

function dedupeStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((s) => s && s.trim().length > 0)));
}

function inferMissingFromRules(unmet: ReadinessRule[]): string[] {
  return unmet.filter((r) => /document/i.test(r.id)).map((r) => r.label);
}

/* ------------------------- rule selection ------------------------------ */

function pickRulesForCase(ctx: ReadinessContext): ReadinessRule[] {
  const tplId = ctx.checklistResponses?.templateId ?? null;
  if (tplId === "constitucional.educacao.creche") return CRECHE_RULES;
  // Heurística: se area contém "Educação"+"Infância", ainda assim usa creche.
  if (
    ctx.area.some((a) => /educa[cç][aã]o/i.test(a)) &&
    ctx.area.some((a) => /inf[aâ]ncia|crian[cç]a/i.test(a))
  ) {
    return CRECHE_RULES;
  }
  return GENERIC_RULES;
}

/* ----------------------------- generic --------------------------------- */

const GENERIC_RULES: ReadinessRule[] = [
  {
    id: "parties_present",
    label: "Partes identificadas",
    weight: 20,
    isSatisfied: (c) => c.parties.length > 0,
    blocker: true,
    nextActionHint: "Identificar partes do caso (autora, ré, terceiros).",
  },
  {
    id: "facts_present",
    label: "Fatos relevantes registrados",
    weight: 20,
    isSatisfied: (c) => c.facts.length >= 2,
    blocker: true,
    nextActionHint: "Coletar pelo menos 2 fatos relevantes (datas, condutas).",
  },
  {
    id: "requests_present",
    label: "Pedidos identificados",
    weight: 20,
    isSatisfied: (c) => c.requests.length > 0,
    blocker: true,
    nextActionHint: "Definir o que será pedido juridicamente.",
  },
  {
    id: "evidence_present",
    label: "Evidências/documentos anexados",
    weight: 20,
    isSatisfied: (c) => c.evidence.length > 0 || c.documents.length > 0,
    nextActionHint: "Anexar documentos comprobatórios.",
  },
  {
    id: "authority_optional",
    label: "Autoridade provável identificada (quando aplicável)",
    weight: 10,
    isSatisfied: (c) => !!c.probableAuthority || c.parties.some((p) => p.role === "opposing_party"),
  },
  {
    id: "documents_complete",
    label: "Documentos mínimos anexados",
    weight: 10,
    isSatisfied: (c) => c.missingDocuments.length === 0,
  },
];

/* ----------------------------- creche ---------------------------------- */

function checklistAnswer(
  ctx: ReadinessContext,
  fieldId: string,
): unknown {
  const a = ctx.checklistResponses?.answers as Record<string, unknown> | undefined;
  return a?.[fieldId];
}

function answerTruthy(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return false;
}

const CRECHE_RULES: ReadinessRule[] = [
  {
    id: "creche_age_proven",
    label: "Idade da criança comprovada (certidão de nascimento ou declaração)",
    weight: 10,
    blocker: true,
    nextActionHint:
      "Solicitar à cliente certidão de nascimento ou documento que comprove idade da criança.",
    isSatisfied: (c) =>
      answerTruthy(checklistAnswer(c, "child_birthdate")) ||
      c.parties.some((p) => p.role === "child_or_dependent" && p.age !== undefined),
  },
  {
    id: "creche_residence_proven",
    label: "Residência no município comprovada",
    weight: 10,
    nextActionHint: "Solicitar comprovante de residência da família.",
    isSatisfied: (c) =>
      answerTruthy(checklistAnswer(c, "address")) ||
      c.parties.some((p) => p.role === "assisted_party" && !!p.address),
  },
  {
    id: "creche_admin_request_proven",
    label: "Pedido administrativo na rede municipal comprovado",
    weight: 15,
    blocker: true,
    nextActionHint: "Solicitar protocolo, número de inscrição ou print da solicitação na Secretaria de Educação.",
    isSatisfied: (c) =>
      answerTruthy(checklistAnswer(c, "admin_request_made")) ||
      answerTruthy(checklistAnswer(c, "admin_request_protocol")),
  },
  {
    id: "creche_negative_response_proven",
    label: "Negativa, fila de espera ou omissão do Município comprovada",
    weight: 20,
    blocker: true,
    nextActionHint:
      "Solicitar à cliente protocolo, print, e-mail ou declaração da Secretaria de Educação que demonstre negativa, fila de espera ou omissão.",
    isSatisfied: (c) =>
      answerTruthy(checklistAnswer(c, "municipality_response")) ||
      answerTruthy(checklistAnswer(c, "waiting_list")) ||
      answerTruthy(checklistAnswer(c, "evidence_documents")),
  },
  {
    id: "creche_urgency_demonstrated",
    label: "Urgência demonstrada (trabalho, vulnerabilidade, ausência de rede)",
    weight: 10,
    nextActionHint: "Coletar elementos que demonstrem urgência (jornada de trabalho, vulnerabilidade social).",
    isSatisfied: (c) =>
      answerTruthy(checklistAnswer(c, "urgency_factors")) ||
      c.requests.some((r) => r.kind === "URGENCY"),
  },
  {
    id: "creche_authority_identified",
    label: "Autoridade municipal provável identificada (Secretaria de Educação)",
    weight: 15,
    nextActionHint: "Identificar Secretaria/Secretário(a) de Educação do município competente.",
    isSatisfied: (c) =>
      !!c.probableAuthority ||
      c.parties.some((p) => p.role === "authority"),
  },
  {
    id: "creche_documents_minimal",
    label: "Documentos mínimos anexados (certidão, comprovante, protocolo)",
    weight: 20,
    nextActionHint: "Anexar pelo menos 3 documentos: certidão da criança, comprovante de residência e protocolo/print.",
    isSatisfied: (c) => c.documents.length >= 3,
  },
];
