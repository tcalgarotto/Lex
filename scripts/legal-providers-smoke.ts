import "../src/lib/env-normalize";
import { getEnv } from "../src/lib/env";
import { LexmlCorpusProvider } from "../src/lib/corpus/providers/lexml";
import { StfCorpusProvider } from "../src/lib/corpus/providers/stf";
import { StjCorpusProvider } from "../src/lib/corpus/providers/stj";
import { DatajudCorpusProvider } from "../src/lib/corpus/providers/datajud";
import { CamaraCorpusProvider } from "../src/lib/corpus/providers/camara";
import { SenadoCorpusProvider } from "../src/lib/corpus/providers/senado";
import { PlanaltoCorpusProvider } from "../src/lib/corpus/providers/planalto";
import {
  DATAJUD_ALIASES,
  getAliasEntry,
} from "../src/lib/datajud/datajud-aliases";

type SmokeResult = {
  name: string;
  ok: boolean;
  tookMs: number;
  detail?: string;
  error?: string;
};

const args = new Set(process.argv.slice(2));
const includeAllDataJud = args.has("--datajud-all");
const onlyDataJudAll = args.has("--only-datajud-all");

async function smoke(name: string, fn: () => Promise<string>): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, tookMs: Date.now() - start, detail };
  } catch (error) {
    return {
      name,
      ok: false,
      tookMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const env = getEnv();
  const results: SmokeResult[] = [];

  if (!onlyDataJudAll) results.push(
    await smoke("Planalto", async () => {
      const provider = new PlanaltoCorpusProvider({ timeoutMs: 10_000, retries: 1 });
      const list = await provider.list({});
      const candidate = list.candidates[0];
      if (!candidate) throw new Error("catalogo sem candidato");
      const payload = await provider.fetch(candidate);
      return `${candidate.identifier}; chars=${payload.rawText.length}`;
    }),
  );

  if (!onlyDataJudAll) results.push(
    await smoke("LexML", async () => {
      const provider = new LexmlCorpusProvider({
        timeoutMs: 10_000,
        maxRetries: 1,
        ratePerMinute: 120,
      });
      const page = await provider.list({ pageSize: 1 });
      return `candidates=${page.candidates.length}; total=${page.totalEstimated ?? "n/a"}`;
    }),
  );

  if (!onlyDataJudAll) results.push(
    await smoke("DataJud default", async () => {
      const alias = env.DATAJUD_DEFAULT_ALIAS;
      if (!env.DATAJUD_API_KEY) throw new Error("DATAJUD_API_KEY ausente");
      if (!getAliasEntry(alias)) throw new Error(`alias DataJud invalido: ${alias}`);
      const provider = new DatajudCorpusProvider({
        alias,
        apiKey: env.DATAJUD_API_KEY,
        baseUrl: env.DATAJUD_BASE_URL,
        timeoutMs: 30_000,
        ratePerMinute: 120,
      });
      const page = await provider.list({ pageSize: 1 });
      return `${alias}; candidates=${page.candidates.length}; total=${page.totalEstimated ?? "n/a"}`;
    }),
  );

  if (!onlyDataJudAll) results.push(
    await smoke("STF", async () => {
      const provider = new StfCorpusProvider({
        timeoutMs: 10_000,
        maxIds: 3,
        ratePerMinute: 120,
      });
      const page = await provider.list({ pageSize: 1 });
      if (page.candidates.length === 0) throw new Error("STF respondeu, mas sem candidatos extraidos");
      return `candidates=${page.candidates.length}; next=${page.nextCursor ?? "fim"}`;
    }),
  );

  if (!onlyDataJudAll) results.push(
    await smoke("STJ", async () => {
      const provider = new StjCorpusProvider({
        timeoutMs: 10_000,
        maxIds: 1,
        ratePerMinute: 120,
      });
      const page = await provider.list({ pageSize: 1 });
      const candidate = page.candidates[0];
      if (!candidate) throw new Error("sem sumula STJ inicial");
      const payload = await provider.fetch(candidate);
      return `${candidate.identifier}; chars=${payload.rawText.length}`;
    }),
  );

  if (!onlyDataJudAll) results.push(
    await smoke("Camara", async () => {
      const provider = new CamaraCorpusProvider({
        timeoutMs: 10_000,
        ratePerMinute: 120,
        itensPorPagina: 1,
      });
      const page = await provider.list({ pageSize: 1 });
      if (page.candidates.length === 0) throw new Error("Camara respondeu, mas sem proposicoes extraidas");
      return `candidates=${page.candidates.length}; next=${page.nextCursor ?? "fim"}`;
    }),
  );

  if (!onlyDataJudAll) results.push(
    await smoke("Senado", async () => {
      const provider = new SenadoCorpusProvider({
        timeoutMs: 10_000,
        ratePerMinute: 120,
      });
      const page = await provider.list({ pageSize: 1 });
      if (page.candidates.length === 0) throw new Error("Senado respondeu, mas sem materias extraidas");
      return `candidates=${page.candidates.length}; next=${page.nextCursor ?? "fim"}`;
    }),
  );

  if (includeAllDataJud || onlyDataJudAll) {
    if (!env.DATAJUD_API_KEY) throw new Error("DATAJUD_API_KEY ausente");
    for (const entry of DATAJUD_ALIASES) {
      results.push(
        await smoke(`DataJud ${entry.acronym}`, async () => {
          const provider = new DatajudCorpusProvider({
            alias: entry.alias,
            apiKey: env.DATAJUD_API_KEY,
            baseUrl: env.DATAJUD_BASE_URL,
            timeoutMs: 30_000,
            ratePerMinute: 120,
          });
          const page = await provider.list({ pageSize: 1 });
          return `${entry.alias}; candidates=${page.candidates.length}; total=${page.totalEstimated ?? "n/a"}`;
        }),
      );
    }
  }

  console.table(results);
  console.log(JSON.stringify({ ok: results.every((r) => r.ok), results }, null, 2));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((error) => {
  console.error("legal-providers-smoke fatal:", error);
  process.exit(1);
});
