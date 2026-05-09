/**
 * Filtros Qdrant para `lex_corpus_norms` / `lex_corpus_jurisprudence`.
 *
 * Suporta **dois formatos de payload** durante a janela de migração:
 *  - **Novo** (pós `qdrant:migrate-hybrid`): `workspaceId="_global_"`,
 *    `layer="legal_corpus"`, `status="ACTIVE"`.
 *  - **Legado** (embeddings antes da hybrid migration): `workspaceId="__global__"`
 *    (`GLOBAL_WORKSPACE_ID`), sem campo `layer`.
 *
 * Não exigimos `layer` no filtro — pontos legados não possuem esse campo.
 * Restringimos apenas `workspaceId ∈ { "_global_", "__global__" }` + `ACTIVE`,
 * o que isola `lex_corpus_*` dos uploads (`lex_main` é outra collection).
 */

import { GLOBAL_WORKSPACE_ID, LEGAL_CORPUS_TENANT_ID } from "@/lib/constants";
import type { LegalRetrievalFilters } from "./types";

/** Exportado para auditoria / scripts que precisam saber os valores aceitos. */
export const CORPUS_WORKSPACE_IDS = [LEGAL_CORPUS_TENANT_ID, GLOBAL_WORKSPACE_ID] as const;

/** Condições derivadas de `LegalRetrievalFilters` (sem tenant). */
function userFilterConditions(filters: LegalRetrievalFilters | undefined): Record<string, unknown>[] {
  const must: Record<string, unknown>[] = [];
  if (!filters) return must;

  if (filters.kinds?.length) {
    must.push({ key: "kind", match: { any: filters.kinds.map(String) } });
  }
  if (filters.jurisdictions?.length) {
    must.push({ key: "jurisdiction", match: { any: filters.jurisdictions.map(String) } });
  }
  if (filters.tribunals?.length) {
    must.push({ key: "tribunal", match: { any: filters.tribunals } });
  }
  if (filters.articleRefs?.length) {
    must.push({ key: "articleRef", match: { any: filters.articleRefs } });
  }
  if (filters.incisoRefs?.length) {
    must.push({ key: "incisoRef", match: { any: filters.incisoRefs } });
  }
  if (filters.paragraphRefs?.length) {
    must.push({ key: "paragraphRef", match: { any: filters.paragraphRefs } });
  }
  if (filters.normUrns?.length) {
    must.push({ key: "normUrn", match: { any: filters.normUrns } });
  }
  if (filters.publishedAfter) {
    const ts = Math.floor(filters.publishedAfter.getTime() / 1000);
    must.push({ key: "publishedAtTs", range: { gte: ts } });
  }
  if (filters.asOf) {
    const ts = Math.floor(filters.asOf.getTime() / 1000);
    must.push({ key: "validFromTs", range: { lte: ts } });
  }
  return must;
}

/**
 * Filtro completo para buscas no corpus jurídico em Qdrant (dense/hybrid).
 */
export function buildCorpusNormsFilter(filters: LegalRetrievalFilters | undefined): Record<string, unknown> {
  const user = userFilterConditions(filters);

  const must: Record<string, unknown>[] = [
    {
      key: "workspaceId",
      match: { any: [...CORPUS_WORKSPACE_IDS] },
    },
    { key: "status", match: { value: "ACTIVE" } },
    ...user,
  ];

  return { must };
}
