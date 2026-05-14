import { getEnv } from "@/lib/env";

/** UI/API: pesquisa jurídica assistida no corpus desligada por `ENABLE_LEGAL_RETRIEVAL=false`. */
export function isAnyCorpusSearchConfigMuted(): boolean {
  return !getEnv().ENABLE_LEGAL_RETRIEVAL;
}
