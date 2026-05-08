/**
 * `npm run corpus:seed:official-laws`
 *
 * Baixa, parseia e indexa as 15 leis/códigos federais oficiais do
 * catálogo `src/lib/corpus/official-laws/catalog.ts`. Cada lei vem do
 * Planalto (URL declarada no catálogo) e é persistida com:
 *
 *   - `LegalNorm` + `LegalNormVersion` (Prisma)
 *   - `LegalChunk` por artigo (chunker hierárquico)
 *   - upsert no Qdrant `lex_corpus_norms` (BGE-M3 embeddings)
 *
 * Idempotente: contentHash decide se há nova versão. Quando `--dry-run`,
 * só baixa e parseia, sem persistir.
 *
 * Flags:
 *   --only=cpc,cdc      Filtra por keys do catálogo (case-insensitive).
 *   --dry-run           Baixa + parseia, não persiste.
 *   --no-fetch          Pula download (usa cache `tests/fixtures/planalto/<key>.html`).
 *   --no-embed          Pula upsert no Qdrant.
 *   --max-laws=N        Para após N leis (debug).
 *   --rate-ms=N         Atraso entre downloads. Default 4000ms (15/min).
 *
 * Critérios de pronto:
 *   - LegalNorm >= 12 (catálogo tem 15)
 *   - LegalChunk >= 100 (cada lei traz dezenas de artigos)
 */

import "../src/lib/env-normalize";
import path from "node:path";
import fs from "node:fs/promises";
import { CorpusProvider, NormKind } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { upsertCorpusPayload } from "../src/lib/corpus/repository";
import { embedAndUpsertNormVersion } from "../src/lib/corpus/embeddings-pipeline";
import {
  OFFICIAL_LAWS,
  filterLawsByKeys,
  type OfficialLaw,
} from "../src/lib/corpus/official-laws/catalog";
import {
  PlanaltoCorpusProvider,
  lawToCandidate,
  parsedLawToCorpusPayload,
  fetchPlanaltoLaw,
  PlanaltoError,
} from "../src/lib/corpus/providers/planalto";
import {
  parsePlanaltoLawHtml,
  decodePlanaltoBuffer,
} from "../src/lib/corpus/providers/planalto-parser";

type Flags = {
  only: string[];
  dryRun: boolean;
  noFetch: boolean;
  noEmbed: boolean;
  maxLaws: number;
  rateMs: number;
};

function parseFlags(argv: string[]): Flags {
  const only =
    argv
      .find((a) => a.startsWith("--only="))
      ?.slice("--only=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const maxLaws = Number(
    argv.find((a) => a.startsWith("--max-laws="))?.slice("--max-laws=".length) ?? OFFICIAL_LAWS.length,
  );
  const rateMs = Number(
    argv.find((a) => a.startsWith("--rate-ms="))?.slice("--rate-ms=".length) ?? "4000",
  );
  return {
    only,
    dryRun: argv.includes("--dry-run"),
    noFetch: argv.includes("--no-fetch"),
    noEmbed: argv.includes("--no-embed"),
    maxLaws,
    rateMs,
  };
}

const FIXTURES_DIR = path.resolve(
  __dirname,
  "..",
  "tests",
  "fixtures",
  "planalto",
);
const CACHE_DIR = path.resolve(__dirname, "..", ".cache", "planalto");

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readFromCache(key: string): Promise<string | null> {
  for (const dir of [FIXTURES_DIR, CACHE_DIR]) {
    const file = path.join(dir, `${key.toLowerCase()}.html`);
    try {
      return await fs.readFile(file, "utf-8");
    } catch {
      // miss
    }
  }
  return null;
}

async function writeToCache(key: string, html: string): Promise<void> {
  await ensureCacheDir();
  const file = path.join(CACHE_DIR, `${key.toLowerCase()}.html`);
  await fs.writeFile(file, html, "utf-8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type LawProcessResult =
  | {
      ok: true;
      law: OfficialLaw;
      articleCount: number;
      revoked: number;
      versionId?: string;
      versioned: boolean;
      created: boolean;
      chunks: number;
      bytes: number;
    }
  | { ok: false; law: OfficialLaw; error: string };

async function processOneLaw(
  law: OfficialLaw,
  flags: Flags,
  provider: PlanaltoCorpusProvider,
): Promise<LawProcessResult> {
  // 1. Obter HTML (cache → planalto).
  let html: string | null = null;
  if (flags.noFetch) {
    html = await readFromCache(law.key);
    if (!html) {
      return {
        ok: false,
        law,
        error: `--no-fetch mas não há cache em ${CACHE_DIR}/${law.key.toLowerCase()}.html nem fixture.`,
      };
    }
  } else {
    try {
      const result = await fetchPlanaltoLaw(law.sourceUrl, {
        timeoutMs: 60_000,
        retries: 3,
      });
      if (!result.html) {
        return {
          ok: false,
          law,
          error: `Planalto devolveu status=${result.status} sem html`,
        };
      }
      html = result.html;
      await writeToCache(law.key, html);
    } catch (err) {
      const msg = err instanceof PlanaltoError ? err.message : String(err);
      return { ok: false, law, error: `fetch falhou: ${msg}` };
    }
  }

  // 2. Parse.
  const parsed = parsePlanaltoLawHtml(html);
  if (parsed.articles.length === 0) {
    return {
      ok: false,
      law,
      error: `parser não encontrou artigos (HTML mudou?)`,
    };
  }

  // 3. Sanity check: bate com expectedArticleCount?
  const inRange =
    parsed.articles.length >= law.expectedArticleCount.min &&
    parsed.articles.length <= law.expectedArticleCount.max;
  if (!inRange) {
    console.warn(
      `   ⚠ Articulos extraídos (${parsed.articles.length}) fora da faixa esperada (${law.expectedArticleCount.min}-${law.expectedArticleCount.max}) para ${law.key}`,
    );
  }

  if (flags.dryRun) {
    return {
      ok: true,
      law,
      articleCount: parsed.articles.length,
      revoked: parsed.stats.articlesRevoked,
      versioned: false,
      created: false,
      chunks: 0,
      bytes: parsed.stats.bytes,
    };
  }

  // 4. Persistir via upsert.
  const candidate = lawToCandidate(law);
  const payload = parsedLawToCorpusPayload(candidate, parsed, html);
  const result = await upsertCorpusPayload(payload, {
    provider: CorpusProvider.PLANALTO,
  });

  // `provider` é exportado mas não usado diretamente aqui.
  void provider;

  return {
    ok: true,
    law,
    articleCount: parsed.articles.length,
    revoked: parsed.stats.articlesRevoked,
    ...(result.versioned ? { versionId: result.versionId } : {}),
    versioned: result.versioned,
    created: result.created,
    chunks: result.chunksUpserted,
    bytes: parsed.stats.bytes,
  };
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const laws = filterLawsByKeys(flags.only).slice(0, flags.maxLaws);

  console.log("═══ CORPUS SEED OFFICIAL LAWS (Planalto) ═══");
  console.log(`leis     : ${laws.length} ${flags.only.length > 0 ? `(only=${flags.only.join(",")})` : ""}`);
  console.log(`dry-run  : ${flags.dryRun}`);
  console.log(`no-fetch : ${flags.noFetch}`);
  console.log(`no-embed : ${flags.noEmbed}`);
  console.log(`rate     : ${flags.rateMs}ms entre downloads`);
  console.log("");

  const before = {
    norms: await prisma.legalNorm.count(),
    versions: await prisma.legalNormVersion.count(),
    chunks: await prisma.legalChunk.count(),
  };
  console.log("Antes:");
  console.log(`  LegalNorm        : ${before.norms}`);
  console.log(`  LegalNormVersion : ${before.versions}`);
  console.log(`  LegalChunk       : ${before.chunks}`);
  console.log("");

  console.log("Plano:");
  for (const l of laws) {
    console.log(`  • ${l.key.padEnd(8)} ${l.identifier.padEnd(28)} ${l.title}`);
  }
  console.log("");

  const provider = new PlanaltoCorpusProvider({
    timeoutMs: 60_000,
    retries: 3,
  });

  const results: LawProcessResult[] = [];
  for (let i = 0; i < laws.length; i++) {
    const law = laws[i]!;
    process.stdout.write(`  [${i + 1}/${laws.length}] ${law.key.padEnd(8)} ${law.identifier.padEnd(28)} ... `);
    const r = await processOneLaw(law, flags, provider);
    results.push(r);
    if (r.ok) {
      console.log(
        `✓ articles=${r.articleCount} chunks=${r.chunks} bytes=${(r.bytes / 1024).toFixed(0)}KB ${r.created ? "[novo]" : r.versioned ? "[atualizado]" : "[idêntico]"}`,
      );
    } else {
      console.log(`✗ ${r.error}`);
    }
    if (i < laws.length - 1 && !flags.noFetch) {
      await sleep(flags.rateMs);
    }
  }

  console.log("");

  // 5. Embedding do que foi versionado nesta passada.
  const newVersions = results
    .filter((r): r is Extract<LawProcessResult, { ok: true }> => r.ok && r.versioned)
    .map((r) => r.versionId!)
    .filter(Boolean);

  if (!flags.dryRun && !flags.noEmbed && newVersions.length > 0) {
    console.log(`Indexando ${newVersions.length} versão(ões) no Qdrant lex_corpus_norms…`);
    let totalEmbedded = 0;
    let totalErrors = 0;
    for (const versionId of newVersions) {
      try {
        const r = await embedAndUpsertNormVersion({ normVersionId: versionId });
        totalEmbedded += r.chunksProcessed;
        totalErrors += r.errors;
        console.log(
          `  ✔ version ${versionId}  processed=${r.chunksProcessed}  errors=${r.errors}  ${r.durationMs}ms`,
        );
      } catch (err) {
        totalErrors++;
        console.error(`  ✗ version ${versionId} falhou:`, (err as Error).message);
      }
    }
    console.log(`Total: ${totalEmbedded} chunks embedados, ${totalErrors} erros.`);
    console.log("");
  }

  const after = {
    norms: await prisma.legalNorm.count(),
    versions: await prisma.legalNormVersion.count(),
    chunks: await prisma.legalChunk.count(),
  };
  console.log("Depois:");
  console.log(`  LegalNorm        : ${after.norms}  (Δ ${after.norms - before.norms})`);
  console.log(`  LegalNormVersion : ${after.versions}  (Δ ${after.versions - before.versions})`);
  console.log(`  LegalChunk       : ${after.chunks}  (Δ ${after.chunks - before.chunks})`);
  console.log("");

  // Sanity: nenhuma norma Planalto entrou como jurisprudência.
  const seeded = await prisma.legalNorm.findMany({
    where: { sourceProvider: CorpusProvider.PLANALTO },
    select: { urn: true, kind: true },
  });
  const wrong = seeded.filter(
    (n) =>
      n.kind === NormKind.JURISPRUDENCE_STF ||
      n.kind === NormKind.JURISPRUDENCE_STJ ||
      n.kind === NormKind.JURISPRUDENCE_TST ||
      n.kind === NormKind.SUMULA_STF ||
      n.kind === NormKind.SUMULA_STJ,
  );
  if (wrong.length > 0) {
    console.log(`⚠ ${wrong.length} normas Planalto com kind de jurisprudência (collection errada):`);
    for (const w of wrong) console.log(`     ${w.urn}  ${w.kind}`);
  }

  // Critérios.
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.log(`✗ ${failures.length} lei(s) falhou(am):`);
    for (const f of failures) {
      console.log(`     ${f.law.key}: ${"error" in f ? f.error : ""}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`✅ ${results.length} lei(s) processada(s) com sucesso.`);
  }
}

main()
  .catch((err) => {
    console.error("\nFalha geral:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
