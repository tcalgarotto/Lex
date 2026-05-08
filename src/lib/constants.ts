/** Vetores e chunks da legislação/jurisprudência global compartilhados entre workspaces */
export const GLOBAL_WORKSPACE_ID = "__global__";

export const WORKSPACE_COOKIE = "lex_workspace_id";

/**
 * Tenant id usado em `lex_corpus_norms` / `lex_corpus_jurisprudence`
 * (corpus jurídico oficial, multi-tenant via Qdrant `is_tenant=true`).
 *
 * Diferente de `GLOBAL_WORKSPACE_ID` ("__global__") — esse é usado em
 * `lex_main` (uploads dos usuários). Mantemos os dois identificadores
 * separados porque as collections têm regras de tenant separadas e o
 * briefing pede literalmente "_global_" para o corpus oficial.
 */
export const LEGAL_CORPUS_TENANT_ID = "_global_";

/** Layer do payload Qdrant — corpus jurídico oficial (legislação/jurisprudência). */
export const CORPUS_LAYER_LEGAL = "legal_corpus";

/** Layer do payload Qdrant — chunks de documentos enviados pelo workspace. */
export const CORPUS_LAYER_WORKSPACE_DOC = "workspace_document";
