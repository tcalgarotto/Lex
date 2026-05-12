import { getEnv } from "@/lib/env";

/** UI/API: retrieval jurídico desligado por `ENABLE_LEGAL_RETRIEVAL=false`. */
export function isAnyCorpusSearchConfigMuted(): boolean {
  return !getEnv().ENABLE_LEGAL_RETRIEVAL;
}
