/**
 * `npm run datajud:check`
 *
 * Diagnóstico rápido do DataJud: lê env, mostra status do registry, e — se
 * tiver chave — faz uma probe HTTP simples ao alias configurado para
 * confirmar autenticação e conectividade.
 *
 * Não modifica banco, não escreve no Qdrant. Saída: JSON pretty-print.
 *
 * `npm run datajud:dry-run`
 *
 * Constrói uma query Elasticsearch (search_after vazio, size pequeno) sem
 * chamar a API. Útil para auditar o body que seria enviado.
 */

import "../src/lib/env-normalize";
import { getEnv } from "../src/lib/env";
import { getProviderEntry } from "../src/lib/corpus/providers/registry";
import { CorpusProvider } from "@prisma/client";
import {
  DatajudCorpusProvider,
  buildDatajudListQuery,
} from "../src/lib/corpus/providers/datajud";
import { DATAJUD_ALIASES, getAliasEntry } from "../src/lib/corpus/providers/datajud-aliases";

type CheckResult = {
  status: string;
  mode: string;
  envKeysSet: Record<string, boolean>;
  alias?: string;
  aliasEntry?: ReturnType<typeof getAliasEntry>;
  baseUrl?: string;
  hint?: string;
  probe?:
    | { ok: true; httpStatus: number; tookMs: number; sampleHits?: number }
    | { ok: false; error: string; httpStatus?: number };
};

function bool(v: unknown): boolean {
  return ["true", "1", "yes", "on"].includes(String(v ?? "").toLowerCase());
}

async function probe(
  baseUrl: string,
  alias: string,
  apiKey: string,
): Promise<CheckResult["probe"]> {
  const url = `${baseUrl}/${alias}/_search`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "lex-corpus-sync/1.0 (+https://lex-navy.vercel.app)",
      },
      body: JSON.stringify({
        size: 1,
        query: { match_all: {} },
        sort: [{ "@timestamp": { order: "desc" } }],
      }),
    });
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, error: await res.text() };
    }
    const json = (await res.json()) as { hits?: { total?: { value?: number }; hits?: unknown[] } };
    return {
      ok: true,
      httpStatus: res.status,
      tookMs: Date.now() - start,
      sampleHits: json.hits?.hits?.length ?? 0,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");

  const env = getEnv();
  const entry = getProviderEntry(CorpusProvider.DATAJUD);
  if (!entry) {
    console.error("DataJud não está no registry — bug.");
    process.exit(1);
  }

  const status = entry.status();
  const result: CheckResult = {
    status: status.status,
    mode: status.mode,
    envKeysSet: {
      DATAJUD_API_KEY: Boolean(env.DATAJUD_API_KEY),
      DATAJUD_ALIAS: Boolean(env.DATAJUD_ALIAS),
      DATAJUD_BASE_URL: Boolean(env.DATAJUD_BASE_URL),
      ENABLE_DATAJUD: bool(env.ENABLE_DATAJUD),
    },
    ...(env.DATAJUD_ALIAS ? { alias: env.DATAJUD_ALIAS } : {}),
    ...(env.DATAJUD_ALIAS
      ? { aliasEntry: getAliasEntry(env.DATAJUD_ALIAS) ?? null as never }
      : {}),
    ...(env.DATAJUD_BASE_URL ? { baseUrl: env.DATAJUD_BASE_URL } : {}),
    ...(status.hint ? { hint: status.hint } : {}),
  };

  if (dryRun) {
    const sampleQuery = buildDatajudListQuery({
      size: 5,
      tribunal: "TJSP",
      grau: "G1",
    });
    console.log("== DataJud DRY RUN ==");
    console.log("Status:", JSON.stringify(result, null, 2));
    console.log("Sample query (não enviada):");
    console.log(JSON.stringify(sampleQuery, null, 2));
    console.log("");
    console.log("Aliases conhecidos:");
    console.table(DATAJUD_ALIASES);
    process.exit(0);
  }

  if (status.status === "ok" && env.DATAJUD_API_KEY && env.DATAJUD_ALIAS) {
    console.log("Probing DataJud...");
    result.probe = await probe(
      env.DATAJUD_BASE_URL,
      env.DATAJUD_ALIAS,
      env.DATAJUD_API_KEY,
    );

    // Sanity check do query builder via instância (não envia)
    const sample = DatajudCorpusProvider.buildQuery({
      size: 3,
      tribunal: getAliasEntry(env.DATAJUD_ALIAS)?.tribunal ?? "TJSP",
    });
    console.log("Sample query:", JSON.stringify(sample, null, 2));
  }

  console.log("== DataJud check ==");
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.probe?.ok === false ? 1 : 0);
}

main().catch((e) => {
  console.error("datajud:check fatal:", e);
  process.exit(1);
});
