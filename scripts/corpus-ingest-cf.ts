/**
 * `npm run corpus:ingest-cf`           — modo direto (executa local).
 * `npm run corpus:ingest-cf -- --via-inngest`
 *                                       — dispara o evento Inngest e sai.
 *
 * Modo direto:
 *   - Lê o markdown curado em `codigos de leis/CONSTITUICAO.md`.
 *   - Parseia (`parseConstitutionSemantic`).
 *   - Persiste via `upsertCorpusPayload` (Postgres canonical).
 *   - Embeda + indexa via `embedAndUpsertNormVersion` (Qdrant
 *     `lex_corpus_norms`).
 *   - Resolve citações pendentes que apontavam para a CF.
 *   - Imprime estatísticas antes/depois.
 *
 * Modo `--via-inngest`:
 *   - Manda o evento `lex/corpus.ingest-cf` para o Inngest. O job real é
 *     executado pelo handler em `src/lib/inngest/functions/ingest-constitution.ts`.
 *   - Útil em produção pra ter retries, observabilidade e steps no console.
 *
 * Flags:
 *   --via-inngest        Dispara via Inngest em vez de executar local.
 *   --skip-embed         Pula a etapa de embeddings (só DB).
 *   --markdown=<path>    Override do caminho do markdown.
 *   --dry-run            Parseia e mostra stats, sem persistir.
 */

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { inngest } from "../src/lib/inngest/client";
import { loadParsedConstitution } from "../src/lib/corpus/providers/markdown-cf";
import { ingestConstitutionDirect } from "../src/lib/inngest/functions/ingest-constitution";

type Flags = {
  viaInngest: boolean;
  skipEmbed: boolean;
  markdownPath: string | undefined;
  dryRun: boolean;
};

function parseFlags(argv: string[]): Flags {
  return {
    viaInngest: argv.includes("--via-inngest"),
    skipEmbed: argv.includes("--skip-embed"),
    markdownPath:
      argv
        .find((a) => a.startsWith("--markdown="))
        ?.slice("--markdown=".length) ?? undefined,
    dryRun: argv.includes("--dry-run"),
  };
}

async function readDbCounts(): Promise<{
  norms: number;
  versions: number;
  chunks: number;
  citations: number;
}> {
  const [norms, versions, chunks, citations] = await Promise.all([
    prisma.legalNorm.count(),
    prisma.legalNormVersion.count(),
    prisma.legalChunk.count(),
    prisma.legalCitation.count(),
  ]);
  return { norms, versions, chunks, citations };
}

async function readQdrantPoints(): Promise<{ norms: number; jurisprudence: number } | null> {
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) return null;
  const headers: Record<string, string> = {};
  if (apiKey) headers["api-key"] = apiKey;
  const fetchCount = async (col: string): Promise<number> => {
    try {
      const res = await fetch(`${url}/collections/${col}`, { headers, cache: "no-store" });
      if (!res.ok) return -1;
      const json = (await res.json()) as { result?: { points_count?: number } };
      return json.result?.points_count ?? 0;
    } catch {
      return -1;
    }
  };
  return {
    norms: await fetchCount("lex_corpus_norms"),
    jurisprudence: await fetchCount("lex_corpus_jurisprudence"),
  };
}

async function runDirect(flags: Flags): Promise<void> {
  const before = await readDbCounts();
  const qBefore = await readQdrantPoints();

  console.log("═══ CF INGEST (direct) ═══");
  console.log(`  markdown : ${flags.markdownPath ?? "<default>"}`);
  console.log(`  dry-run  : ${flags.dryRun}`);
  console.log(`  skip-embed: ${flags.skipEmbed}`);
  console.log("");
  console.log("[Antes — DB]");
  console.table(before);
  if (qBefore) {
    console.log("[Antes — Qdrant]");
    console.table(qBefore);
  }
  console.log("");

  const t0 = Date.now();
  const { md, parsed } = await loadParsedConstitution(flags.markdownPath);
  console.log(
    `Parsed em ${Date.now() - t0}ms — articlesMain=${parsed.stats.articlesMain} articlesAdct=${parsed.stats.articlesAdct} incisos=${parsed.stats.incisos} paragrafos=${parsed.stats.paragrafos} alineas=${parsed.stats.alineas}`,
  );

  if (flags.dryRun) {
    console.log("→ Dry-run. Nada persistido.");
    return;
  }

  console.log(`MD: ${(md.length / 1024).toFixed(1)}KB`);

  const t1 = Date.now();
  const out = await ingestConstitutionDirect({
    markdownPath: flags.markdownPath,
    skipEmbed: flags.skipEmbed,
  });
  for (const seg of [
    { label: "MAIN", data: out.main, resolved: out.resolved.main },
    { label: "ADCT", data: out.adct, resolved: out.resolved.adct },
  ]) {
    const d = seg.data;
    console.log(
      `[${seg.label}] urn=${d.urn} chunks=${d.ingest.chunks} citations=${d.ingest.citations} enriched=${d.enrich.updated}/${d.enrich.updated + d.enrich.missing} resolved=${seg.resolved}`,
    );
    if (d.embed) {
      console.log(
        `   Embeddings — processed=${d.embed.processed} skipped=${d.embed.skipped} errors=${d.embed.errors}`,
      );
    } else if (!d.ingest.versioned) {
      console.log("   (versão idêntica à anterior — skip embed)");
    }
  }
  console.log(`Pipeline total em ${Date.now() - t1}ms`);

  const after = await readDbCounts();
  const qAfter = await readQdrantPoints();
  console.log("");
  console.log("[Depois — DB]");
  console.table(after);
  if (qAfter) {
    console.log("[Depois — Qdrant]");
    console.table(qAfter);
  }

  console.log("");
  console.log(`✔ CF ingerida em ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

async function runViaInngest(flags: Flags): Promise<void> {
  const eventKey = (process.env["INNGEST_EVENT_KEY"] ?? "").trim();
  if (!eventKey) {
    console.error(
      "INNGEST_EVENT_KEY ausente — sem ela `inngest.send()` cai em modo dev e não dispara o handler de produção.\n" +
        "Configure INNGEST_EVENT_KEY (production) no .env para usar --via-inngest.",
    );
    process.exit(1);
  }
  console.log("═══ CF INGEST (via inngest) ═══");
  console.log(`  event    : lex/corpus.ingest-cf`);
  console.log(`  markdown : ${flags.markdownPath ?? "<default>"}`);
  console.log(`  skip-embed: ${flags.skipEmbed}`);
  console.log("");
  const ids = await inngest.send({
    name: "lex/corpus.ingest-cf",
    data: {
      ...(flags.markdownPath ? { markdownPath: flags.markdownPath } : {}),
      ...(flags.skipEmbed ? { skipEmbed: true } : {}),
    },
  });
  console.log(`Evento enviado. ids=${JSON.stringify(ids.ids)}`);
  console.log("Acompanhe execução em https://app.inngest.com (Apps → Functions → ingest-constitution).");
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.viaInngest) {
    await runViaInngest(flags);
  } else {
    await runDirect(flags);
  }
}

main()
  .catch((err) => {
    console.error("\nFalha:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
