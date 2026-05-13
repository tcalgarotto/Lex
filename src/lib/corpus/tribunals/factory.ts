/**
 * Factory de provider por tribunal.
 *
 * Princípio: o pipeline de ingestão (Inngest + repository) é provider-agnóstico.
 * Esta factory mapeia um `TribunalEntry` para o `CorpusProviderClient` mais
 * adequado:
 *   - STF → `StfCorpusProvider` (real, súmulas + SV)
 *   - STJ → `StjCorpusProvider` (scaffold)
 *   - TST/TSE/STM → `LexmlCorpusProvider` (legislação correlata)
 *   - TRFs/TRTs/TREs/TJs/TJMs → `DatajudCorpusProvider` (alias por sigla)
 *
 * Para os providers que precisam de credenciais (Datajud), aceita parâmetros
 * adicionais via `RequestProviderOpts`.
 */

import type { CorpusProviderClient } from "@/lib/corpus/providers/types";
import { fixtureProvider } from "@/lib/corpus/providers/fixture";
import { lexmlProvider } from "@/lib/corpus/providers/lexml";
import { StfCorpusProvider } from "@/lib/corpus/providers/stf";
import { StjCorpusProvider } from "@/lib/corpus/providers/stj";
import { DatajudCorpusProvider } from "@/lib/corpus/providers/datajud";
import { resolveDataJudAliasFromTribunalAcronym } from "@/lib/datajud/datajud-aliases";
import { getTribunal, type TribunalEntry } from "./registry";

export type RequestProviderOpts = {
  datajudApiKey?: string;
  /** Override do alias DataJud (default = registry oficial CNJ por sigla). */
  datajudAlias?: string;
};

export function providerForTribunalCode(
  code: string,
  opts: RequestProviderOpts = {},
): CorpusProviderClient {
  const t = getTribunal(code);
  if (!t) throw new Error(`Tribunal desconhecido: ${code}`);
  return providerForTribunal(t, opts);
}

export function providerForTribunal(
  t: TribunalEntry,
  opts: RequestProviderOpts = {},
): CorpusProviderClient {
  switch (t.code) {
    case "STF":
      return new StfCorpusProvider();
    case "STJ":
      return new StjCorpusProvider();
    case "TST":
    case "TSE":
    case "STM":
      return lexmlProvider();
  }
  if (t.tier === "TRF" || t.tier === "TRT" || t.tier === "TRE" || t.tier === "TJ" || t.tier === "TJM") {
    const alias = opts.datajudAlias ?? defaultDatajudAlias(t);
    const datajudOpts: { alias: string; apiKey?: string } = { alias };
    if (opts.datajudApiKey) datajudOpts.apiKey = opts.datajudApiKey;
    return new DatajudCorpusProvider(datajudOpts);
  }
  return fixtureProvider();
}

export function defaultDatajudAlias(t: TribunalEntry): string {
  const alias = resolveDataJudAliasFromTribunalAcronym(t.code);
  if (!alias) throw new Error(`Tribunal sem alias DataJud oficial: ${t.code}`);
  return alias;
}
