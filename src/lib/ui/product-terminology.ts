/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 *
 * Terminologia canônica: substituir jargão interno por linguagem jurídica clara na interface.
 */

/** Biblioteca / resultados híbridos: item autorizado a entrar na busca assistida. */
export const LIBRARY_BADGE_OPT_IN_SEARCH = "Incluir na busca assistida";

/** Texto curto para lembrar limite do acervo em superfícies de produto (sem jargão interno). */
export const RAG_SCOPE_REMINDER =
  "As respostas usam apenas trechos do acervo indexado; se o tema não estiver coberto, o sistema deve sinalizar lacuna — sem inventar fundamento.";

export const PRODUCT_TERMINOLOGY = {
  "RAG indisponível": "Pesquisa interna em otimização",
  "Chunk recuperado": "Trecho encontrado",
  Embedding: "Índice de busca",
  embedding: "Índice de busca",
  "Fallback DeepSeek": "Pesquisa assistida por IA",
  "Legal foundation candidate": "Fundamento sugerido",
  Unverified: "A conferir",
  "AI_RECOMMENDED_UNVERIFIED": "A conferir",
  Verified: "Verificado",
  USER_PINNED: "Fixado no caso",
  VERIFIED_BY_INTERNAL_RAG: "Verificado (acervo interno)",
  VERIFIED_BY_OFFICIAL_SOURCE: "Verificado (fonte oficial)",
  Pin: "Fixar no caso",
  "ApprovedLegalFoundation": "Fundamento aprovado",
  Qdrant: "Base de busca do escritório",
  qdrant: "Base de busca do escritório",
  rerank: "Reordenação de relevância",
  vector: "Representação semântica",
  pipeline: "Fluxo de processamento",
  RAG: "Pesquisa interna no acervo",
  rag: "Pesquisa interna no acervo",
  chunk: "Trecho",
  Chunk: "Trecho",
} as const;

export function translateTerm(term: string): string {
  const map = PRODUCT_TERMINOLOGY as Record<string, string>;
  if (term in map) return map[term]!;
  const lower = term.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v;
  }
  return term;
}

export const USER_FACING_MESSAGES = {
  AI_RESULT_REVIEW: "Sugestão de IA — a conferir. Revise antes de usar.",
  JURISPRUDENCE_CONFIRM: "Jurisprudência candidata. Confirme a fonte antes de citar.",
  FOUNDATION_REQUIRES_PIN:
    "Este fundamento será usado na estratégia e na peça apenas se você fixar ou aprovar.",
  RAG_TEMPORARY_NOTICE:
    "O acervo interno está em otimização; esta busca usa assistência de IA externa temporariamente.",
  DEEPSEEK_TRANSPARENCY_TOP:
    "Pesquisa assistida por IA via DeepSeek. Resultados devem ser revisados pelo advogado. A pesquisa interna no acervo será reativada após otimização e validação.",
  GLOBAL_RESEARCH_EMPTY:
    "Nenhum resultado ainda. Ajuste os filtros ou refine a pergunta para encontrar fundamentos aplicáveis.",
} as const;
