import type { LegalIntent } from "./intent";
import type { LegalRetrievalFilters, LegalRetrievalOptions } from "./types";

export type LegalSearchPlanStage =
  | "classify-intent"
  | "rewrite"
  | "hybrid"
  | "bm25"
  | "fusion"
  | "graph"
  | "rerank"
  | "boosts"
  | "grounding";

/**
 * F7.2 — Plano explícito de busca jurídica.
 * O objetivo é tornar o pipeline auditável: quais filtros, por quê, e quais
 * heurísticas/boosts foram aplicadas.
 */
export type LegalSearchPlan = {
  query: string;
  stages: Array<{ stage: LegalSearchPlanStage; why: string }>;
  intent: LegalIntent;
  filters: LegalRetrievalFilters;
  options: Pick<
    Required<LegalRetrievalOptions>,
    "topK" | "rerankPool" | "useGraphExpansion" | "useRerank" | "useQueryRewrite" | "includeGeneric"
  >;
  boosts: Array<{ key: string; description: string }>;
  penalties: Array<{ key: string; description: string }>;
};

export function buildLegalSearchPlan(args: {
  query: string;
  intent: LegalIntent;
  filters: LegalRetrievalFilters;
  options: Required<Pick<LegalRetrievalOptions, "topK" | "rerankPool" | "useGraphExpansion" | "useRerank" | "useQueryRewrite" | "includeGeneric">>;
}): LegalSearchPlan {
  const stages: LegalSearchPlan["stages"] = [
    { stage: "classify-intent", why: "Extrai sinais (artigos, URN, tribunal, data) para filtros e boosts." },
  ];
  if (args.options.useQueryRewrite) {
    stages.push({ stage: "rewrite", why: "Gera variantes semânticas para melhorar recall sem perder precisão." });
  }
  stages.push({ stage: "hybrid", why: "Recupera candidatos via dense+sparse (Qdrant) com filtros do intent." });
  stages.push({ stage: "bm25", why: "Fallback determinístico via FTS (Postgres) e reforço de precisão por artigo." });
  stages.push({ stage: "fusion", why: "Fusão RRF das listas por variante e por fonte (dense/BM25)." });
  if (args.options.useGraphExpansion) {
    stages.push({ stage: "graph", why: "Expande 1-hop no grafo de citações para normas vizinhas relevantes." });
  }
  if (args.options.useRerank) {
    stages.push({ stage: "rerank", why: "Cross-encoder para reordenar os top-N com foco em relevância jurídica." });
  }
  stages.push({ stage: "boosts", why: "Aplica boosts/penalties explicáveis (artigo exato, ADCT, revogação, tamanho)." });
  stages.push({ stage: "grounding", why: "Calcula groundingScore/confidence e garante fonte/trecho citáveis." });

  const boosts: LegalSearchPlan["boosts"] = [
    { key: "exactArticleBoost", description: "Aumenta score quando artigoRef casa exatamente com a query." },
    { key: "topicBoost", description: "Aumenta score quando a norma/alínea bate com área/tópico." },
    { key: "caseContextBoost", description: "Aumenta score quando há contexto do caso (sem virar verdade jurídica)." },
    { key: "pinnedBoost", description: "Aumenta score quando a fonte foi salva/pinada pelo advogado." },
  ];
  const penalties: LegalSearchPlan["penalties"] = [
    { key: "longChunkPenalty", description: "Penaliza chunks longos (menos citáveis; pior UX)." },
    { key: "adctPenalty", description: "Penaliza ADCT fora de contexto (evita dominar top-3 indevidamente)." },
    { key: "revokedPenalty", description: "Penaliza versões revogadas/fora da janela asOf." },
  ];

  return {
    query: args.query,
    stages,
    intent: args.intent,
    filters: args.filters,
    options: args.options,
    boosts,
    penalties,
  };
}

