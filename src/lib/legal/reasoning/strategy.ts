/**
 * Strategy synthesis layer — sintetiza, a partir dos chunks recuperados, uma
 * estrutura argumentativa exibível em painel premium:
 *   - Tese principal (frase curta deduzida do chunk top + intent).
 *   - Argumentos centrais (top chunks, agrupados por norma).
 *   - Contra-argumentos / fatores de risco (vindos do contradiction layer).
 *   - Próximos passos sugeridos (deterministic playbook).
 *
 * É **deterministic**: nenhum LLM é chamado aqui (LLM pode ser plugado depois
 * como aprimorador, sem alterar o fallback).
 */

import { NormKind } from "@prisma/client";
import type { LegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import type { ContradictionRisk } from "./contradiction";
import type { LegalIssue } from "./issue-spotting";

export type StrategyArgument = {
  /** Identificador estável (slug). */
  id: string;
  /** Linha curta — vai como bullet no UI. */
  headline: string;
  /** Texto curto extraído/abreviado do chunk. */
  excerpt: string;
  /** Citações usadas pra gerar este argumento. */
  evidence: { chunkIds: string[]; normUrns: string[] };
  /** Score 0..1 herdado do retrieval. */
  weight: number;
};

export type StrategySynthesis = {
  /** Frase curta — leitura de 1 linha. */
  thesis: string;
  /** 2–4 argumentos chave, ordenados por peso. */
  arguments: StrategyArgument[];
  /** Contra-argumentos: convertidos a partir de risks/contradictions. */
  counterArguments: Array<{ headline: string; detail: string; severity: ContradictionRisk["severity"] }>;
  /** Playbook de próximos passos (heurístico). */
  nextSteps: string[];
  /** Resumo ultracurto (badge): "thesisShort • N args • risk: alta". */
  badge: string;
};

const MAX_EXCERPT = 240;

function trim(text: string, max = MAX_EXCERPT): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).trimEnd() + "…";
}

function deriveThesis(args: {
  query: string;
  intent: LegalIntent;
  topChunk?: LegalRetrievedChunk;
  primaryIssue?: LegalIssue;
}): string {
  const parts: string[] = [];
  if (args.primaryIssue) parts.push(args.primaryIssue.title);
  else if (args.intent.preferredKinds.length > 0) {
    parts.push(`Análise sob a ótica de ${args.intent.preferredKinds[0]!.toLowerCase().replace(/_/g, " ")}`);
  }
  if (args.topChunk) {
    const ref = args.topChunk.norm.identifier ?? args.topChunk.norm.title;
    const path = args.topChunk.fullPath ? ` (${args.topChunk.fullPath})` : "";
    parts.push(`fundamento principal em ${ref}${path}`);
  }
  if (parts.length === 0) parts.push(`Resposta à consulta "${args.query.slice(0, 80)}"`);
  return parts.join(" — ");
}

function buildArgumentsFromChunks(chunks: LegalRetrievedChunk[]): StrategyArgument[] {
  // Agrupa por norma para evitar 4 argumentos da mesma lei.
  const byNorm = new Map<string, LegalRetrievedChunk>();
  for (const c of chunks) {
    if (!byNorm.has(c.norm.urn)) byNorm.set(c.norm.urn, c);
  }
  const top = [...byNorm.values()].slice(0, 4);
  return top.map((c, i) => {
    const ref = c.norm.identifier ?? c.norm.title;
    const path = c.fullPath ?? "";
    const headlinePrefix = i === 0 ? "Fundamento central" : "Argumento de apoio";
    return {
      id: `arg-${i}-${c.chunkId}`,
      headline: `${headlinePrefix}: ${ref}${path ? ` ${path}` : ""}`,
      excerpt: trim(c.text),
      evidence: { chunkIds: [c.chunkId], normUrns: [c.norm.urn] },
      weight: c.scores.final,
    };
  });
}

function buildCounterArguments(risks: ContradictionRisk[]): StrategySynthesis["counterArguments"] {
  return risks.slice(0, 5).map((r) => ({
    headline: r.title,
    detail: r.detail,
    severity: r.severity,
  }));
}

function buildNextSteps(args: {
  intent: LegalIntent;
  hasJurisprudence: boolean;
  hasLegislation: boolean;
  hasRisks: boolean;
  hasIssues: boolean;
}): string[] {
  const steps: string[] = [];
  if (args.intent.classification.queryType === "petition_generation") {
    steps.push("Gerar minuta usando os fundamentos centrais como esqueleto argumentativo.");
  }
  if (!args.hasJurisprudence && args.intent.prefersLegislation) {
    steps.push("Buscar precedente do STF/STJ que aplique a norma encontrada.");
  }
  if (!args.hasLegislation && args.intent.prefersJurisprudence) {
    steps.push("Levantar o dispositivo legal exato em que o precedente se ancora.");
  }
  if (args.hasRisks) {
    steps.push("Antes de fundamentar, valide os pontos sinalizados em 'Riscos & Contradições'.");
  }
  if (args.intent.wantsCurrent) {
    steps.push("Confirmar que cada norma citada está vigente na data do ato/processo.");
  }
  if (args.intent.tribunals.length > 0) {
    steps.push(`Refinar busca focando no(s) tribunal(is) ${args.intent.tribunals.join(", ")}.`);
  }
  if (args.hasIssues) {
    steps.push("Endereçar explicitamente as issues spotadas (cada uma vira tópico no parecer).");
  }
  if (steps.length === 0) {
    steps.push("Confirmar fatos do caso e mapear ao(s) dispositivo(s) recuperado(s).");
  }
  return steps.slice(0, 6);
}

export function synthesizeStrategy(args: {
  query: string;
  intent: LegalIntent;
  chunks: LegalRetrievedChunk[];
  risks: ContradictionRisk[];
  issues: LegalIssue[];
}): StrategySynthesis {
  const topChunk = args.chunks[0];
  const primaryIssue = args.issues[0];
  const thesis = deriveThesis({
    query: args.query,
    intent: args.intent,
    ...(topChunk ? { topChunk } : {}),
    ...(primaryIssue ? { primaryIssue } : {}),
  });
  const arguments_ = buildArgumentsFromChunks(args.chunks);
  const counterArguments = buildCounterArguments(args.risks);

  const sumulaKinds: NormKind[] = [
    NormKind.SUMULA_STF,
    NormKind.SUMULA_STJ,
    NormKind.SUMULA_VINCULANTE,
  ];
  const legislationKinds: NormKind[] = [
    NormKind.CONSTITUTION,
    NormKind.ORDINARY_LAW,
    NormKind.COMPLEMENTARY_LAW,
    NormKind.DECREE,
    NormKind.DECREE_LAW,
    NormKind.CODE,
  ];
  const hasJurisprudence = args.chunks.some(
    (c) => c.norm.kind.toString().startsWith("JURISPRUDENCE") || sumulaKinds.includes(c.norm.kind),
  );
  const hasLegislation = args.chunks.some((c) => legislationKinds.includes(c.norm.kind));

  const highestRisk = args.risks.find((r) => r.severity === "alta")
    ?? args.risks.find((r) => r.severity === "media")
    ?? args.risks[0];

  const nextSteps = buildNextSteps({
    intent: args.intent,
    hasJurisprudence,
    hasLegislation,
    hasRisks: args.risks.length > 0,
    hasIssues: args.issues.length > 0,
  });

  const badge = [
    arguments_.length > 0 ? `${arguments_.length} argumento(s)` : "sem argumentos",
    args.issues.length > 0 ? `${args.issues.length} issue(s)` : null,
    highestRisk ? `risco ${highestRisk.severity}` : "sem riscos",
  ]
    .filter(Boolean)
    .join(" • ");

  return { thesis, arguments: arguments_, counterArguments, nextSteps, badge };
}
