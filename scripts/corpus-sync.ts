/**
 * Trigger manual de sync do corpus jurídico.
 *
 * Uso:
 *   npm run corpus:sync -- --provider=FIXTURE --kind=ORDINARY_LAW
 *   npm run corpus:sync -- --provider=LEXML --kind=ORDINARY_LAW --max-pages=10
 *
 * Faz dispatch via Inngest. Em desenvolvimento local sem Inngest dev server,
 * pode-se usar o modo --inline pra rodar sequencialmente sem fila.
 */

import { CorpusProvider, NormKind } from "@prisma/client";
import { inngest } from "../src/lib/inngest/client";
import { fixtureProvider } from "../src/lib/corpus/providers/fixture";
import { lexmlProvider } from "../src/lib/corpus/providers/lexml";
import { StfCorpusProvider } from "../src/lib/corpus/providers/stf";
import { StjCorpusProvider } from "../src/lib/corpus/providers/stj";
import { DatajudCorpusProvider } from "../src/lib/corpus/providers/datajud";
import type { CorpusProviderClient } from "../src/lib/corpus/providers/types";
import {
  resolvePendingCitationsTo,
  upsertCorpusPayload,
} from "../src/lib/corpus/repository";

type Args = {
  provider: CorpusProvider;
  kind?: NormKind;
  maxPages: number;
  pageSize: number;
  inline: boolean;
};

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([\w-]+)=(.*)$/);
    if (m) map.set(m[1]!, m[2]!);
    else if (a.startsWith("--")) map.set(a.slice(2), "true");
  }
  const providerStr = (map.get("provider") ?? "FIXTURE").toUpperCase();
  if (!Object.values(CorpusProvider).includes(providerStr as CorpusProvider)) {
    throw new Error(`Provider inválido: ${providerStr}`);
  }
  const kindStr = map.get("kind");
  const result: Args = {
    provider: providerStr as CorpusProvider,
    maxPages: Number(map.get("max-pages") ?? "5"),
    pageSize: Number(map.get("page-size") ?? "50"),
    inline: map.get("inline") === "true",
  };
  if (kindStr) {
    const upper = kindStr.toUpperCase() as NormKind;
    if (!Object.values(NormKind).includes(upper)) {
      throw new Error(`Kind inválido: ${kindStr}`);
    }
    result.kind = upper;
  }
  return result;
}

function pickProvider(p: CorpusProvider): CorpusProviderClient {
  switch (p) {
    case CorpusProvider.LEXML:
      return lexmlProvider();
    case CorpusProvider.STF:
      return new StfCorpusProvider();
    case CorpusProvider.STJ:
      return new StjCorpusProvider();
    case CorpusProvider.DATAJUD: {
      const alias = process.env["DATAJUD_ALIAS"] ?? "api_publica_tjsp";
      const apiKey = process.env["DATAJUD_API_KEY"];
      return new DatajudCorpusProvider({ alias, ...(apiKey ? { apiKey } : {}) });
    }
    case CorpusProvider.FIXTURE:
    default:
      return fixtureProvider();
  }
}

async function runInline(args: Args) {
  const client = pickProvider(args.provider);
  let cursor: string | null = null;
  let pages = 0;
  let totalUpserted = 0;

  while (pages < args.maxPages) {
    const page = await client.list({
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
      cursor,
      pageSize: args.pageSize,
    });
    console.log(
      `[corpus] page=${pages} candidates=${page.candidates.length} cursor=${cursor ?? "<inicial>"} -> next=${page.nextCursor ?? "<fim>"}`,
    );
    for (const candidate of page.candidates) {
      try {
        const payload = await client.fetch(candidate);
        const result = await upsertCorpusPayload(payload, { provider: args.provider });
        await resolvePendingCitationsTo(candidate.urn);
        totalUpserted++;
        console.log(
          `  ✓ ${candidate.urn} created=${result.created} versioned=${result.versioned} chunks=${result.chunksUpserted} citations=${result.citationsUpserted}`,
        );
      } catch (err) {
        console.error(`  ✗ ${candidate.urn}: ${(err as Error).message}`);
      }
    }
    cursor = page.nextCursor;
    pages++;
    if (!cursor) break;
  }
  console.log(`[corpus] inline sync finished. pages=${pages} upserted=${totalUpserted}`);
}

async function dispatchInngest(args: Args) {
  await inngest.send({
    name: "lex/corpus.sync",
    data: {
      provider: args.provider,
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
      maxPages: args.maxPages,
      pageSize: args.pageSize,
    },
  });
  console.log(
    `[corpus] disparou lex/corpus.sync provider=${args.provider} kind=${args.kind ?? "<todos>"} maxPages=${args.maxPages}`,
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.inline) await runInline(args);
  else await dispatchInngest(args);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
