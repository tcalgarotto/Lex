/**
 * `npm run corpus:seed:lexml` / `corpus:seed:stf` / `corpus:seed:stj` /
 * `corpus:seed:fixture` / `corpus:seed:all-public`
 *
 * Script unificado de bootstrap do corpus jurídico, usando o registry
 * (`src/lib/corpus/providers/registry.ts`) e modos `--dry-run`/`--inline`.
 *
 * Uso típico:
 *   npm run corpus:seed:lexml -- --dry-run         # plan only
 *   npm run corpus:seed:lexml -- --max-pages=2     # roda inline com cap
 *   npm run corpus:seed:all-public -- --dry-run    # plan completo
 *
 * Diferenças vs. `scripts/corpus-sync.ts`:
 *  - Usa o registry (status/factory) em vez de switch hard-coded.
 *  - Tem suporte a queries seed (LexML por área/domínio).
 *  - `--dry-run` lista candidatos sem chamar embeddings/upsert.
 */

import "../src/lib/env-normalize";
import { CorpusProvider, NormKind } from "@prisma/client";
import {
  getProviderEntry,
  listProviderEntries,
  resolveProvider,
} from "../src/lib/corpus/providers/registry";
import {
  resolvePendingCitationsTo,
  upsertCorpusPayload,
} from "../src/lib/corpus/repository";
import {
  LEXML_SEED_QUERIES,
  getLexmlSeedsForAreas,
} from "../src/lib/corpus/providers/lexml-seed-queries";
import { LexmlCorpusProvider } from "../src/lib/corpus/providers/lexml";
import { getEnv } from "../src/lib/env";
import type { CorpusProviderClient } from "../src/lib/corpus/providers/types";

type Args = {
  provider: CorpusProvider | "all-public";
  kind?: NormKind;
  maxPages: number;
  pageSize: number;
  dryRun: boolean;
  seedAreas?: string[];
};

function parseArgs(): Args {
  const map = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([\w-]+)=(.*)$/);
    if (m) map.set(m[1]!, m[2]!);
    else if (a.startsWith("--")) map.set(a.slice(2), "true");
  }
  const providerStr = (map.get("provider") ?? "FIXTURE").toUpperCase();
  const isAll = providerStr === "ALL-PUBLIC" || providerStr === "ALL_PUBLIC";
  const provider = isAll
    ? ("all-public" as const)
    : (providerStr as CorpusProvider);
  if (
    !isAll &&
    !Object.values(CorpusProvider).includes(provider as CorpusProvider)
  ) {
    throw new Error(`Provider inválido: ${providerStr}`);
  }
  const args: Args = {
    provider,
    maxPages: Number(map.get("max-pages") ?? "5"),
    pageSize: Number(map.get("page-size") ?? "50"),
    dryRun: map.get("dry-run") === "true" || map.get("dry") === "true",
  };
  const kindStr = map.get("kind");
  if (kindStr) {
    const upper = kindStr.toUpperCase() as NormKind;
    if (!Object.values(NormKind).includes(upper)) {
      throw new Error(`Kind inválido: ${kindStr}`);
    }
    args.kind = upper;
  }
  const areas = map.get("areas");
  if (areas) args.seedAreas = areas.split(",").map((a) => a.trim()).filter(Boolean);
  return args;
}

async function runProvider(provider: CorpusProvider, args: Args): Promise<void> {
  const entry = getProviderEntry(provider);
  if (!entry) {
    console.error(`Provider ${provider} não tem entry no registry — pulando.`);
    return;
  }
  const status = entry.status();
  console.log(`\n== ${entry.label} (${provider}) ==`);
  console.log("status:", status.status, "mode:", status.mode);
  if (status.status === "disabled") {
    console.log("→ disabled, pulando.");
    return;
  }
  if (status.status === "not_configured") {
    console.log("→ not_configured.", status.detail ?? "", status.hint ?? "");
    return;
  }

  if (args.dryRun) {
    console.log("→ DRY RUN. Nada será gravado.");
  }

  // LexML especial: se areas fornecido, gera 1 client por seed query.
  if (provider === CorpusProvider.LEXML && args.seedAreas) {
    const seeds = getLexmlSeedsForAreas(args.seedAreas);
    console.log(`→ Iterando ${seeds.length} queries seed para áreas ${args.seedAreas.join(",")}.`);
    for (const seed of seeds) {
      console.log(`  • [${seed.area}] ${seed.label}: query="${seed.query}"`);
      const env = getEnv();
      const client = new LexmlCorpusProvider({
        baseUrl: env.LEXML_BASE_URL,
        ratePerMinute: env.LEXML_RATE_LIMIT_PER_MINUTE,
        freeText: seed.query,
      });
      await iterateClient(client, args, seed.kind);
    }
    return;
  }

  const client = resolveProvider(provider);
  await iterateClient(client, args, args.kind);
}

async function iterateClient(
  client: CorpusProviderClient,
  args: Args,
  kind?: NormKind,
): Promise<void> {
  let cursor: string | null = null;
  let pages = 0;
  let totalUpserted = 0;

  while (pages < args.maxPages) {
    const page = await client.list({
      ...(kind !== undefined ? { kind } : {}),
      cursor,
      pageSize: args.pageSize,
    });
    console.log(
      `    page=${pages} candidates=${page.candidates.length} cursor=${cursor ?? "<inicial>"} -> next=${page.nextCursor ?? "<fim>"}`,
    );
    if (args.dryRun) {
      for (const c of page.candidates.slice(0, 5)) {
        console.log(`    · ${c.urn}`);
      }
      if (page.candidates.length > 5) {
        console.log(`    ... (+${page.candidates.length - 5})`);
      }
    } else {
      for (const candidate of page.candidates) {
        try {
          const payload = await client.fetch(candidate);
          const result = await upsertCorpusPayload(payload);
          await resolvePendingCitationsTo(candidate.urn);
          totalUpserted++;
          console.log(
            `    ✓ ${candidate.urn} created=${result.created} versioned=${result.versioned} chunks=${result.chunksUpserted}`,
          );
        } catch (err) {
          console.error(`    ✗ ${candidate.urn}: ${(err as Error).message}`);
        }
      }
    }
    cursor = page.nextCursor;
    pages++;
    if (!cursor) break;
  }
  if (!args.dryRun) {
    console.log(`    finished. pages=${pages} upserted=${totalUpserted}`);
  }
}

async function main() {
  const args = parseArgs();
  if (args.provider === "all-public") {
    console.log("== Seed all-public providers ==");
    for (const entry of listProviderEntries()) {
      if (entry.id === CorpusProvider.DATAJUD) continue; // requer chave
      await runProvider(entry.id, args);
    }
    return;
  }
  await runProvider(args.provider, args);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// Re-export útil para outros scripts/inngest se quiserem reutilizar:
export { LEXML_SEED_QUERIES };
