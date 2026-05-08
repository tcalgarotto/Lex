/**
 * `npm run corpus:seed:minimal-legal`
 *
 * Popula o banco com o corpus jurídico mínimo verificado manualmente
 * (CF/88, CPC, CC, CDC, Lei Maria da Penha, EAOAB) e dispara embeddings
 * para indexar no Qdrant na collection correta (`lex_corpus_norms`).
 *
 * Idempotente: rodar duas vezes não duplica nada.
 *
 * Flags:
 *   --dry-run   imprime o plano (norms, chunks estimados) sem persistir
 *   --no-embed  pula a etapa de embeddings (útil quando Qdrant ainda não
 *               está pronto)
 *
 * Critério de pronto:
 *   - LegalNorm >= 6
 *   - LegalChunk >= 20
 *   - lex_corpus_norms points >= LegalChunk count das normas mínimas
 */

import "../src/lib/env-normalize";
import { CorpusProvider, NormKind } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { upsertCorpusPayload } from "../src/lib/corpus/repository";
import { embedAndUpsertNormVersion } from "../src/lib/corpus/embeddings-pipeline";
import { buildCanonicalUrn } from "../src/lib/corpus/urn";
import { MINIMAL_LEGAL_NORMS, type MinimalLegalNorm } from "../seed/data/minimal-legal";

type Flags = { dryRun: boolean; noEmbed: boolean };

function parseFlags(argv: string[]): Flags {
  return {
    dryRun: argv.includes("--dry-run"),
    noEmbed: argv.includes("--no-embed"),
  };
}

function buildUrn(n: MinimalLegalNorm): string {
  return buildCanonicalUrn({
    country: "br",
    authority: n.urnInput.authority,
    documentType: n.urnInput.documentType,
    date: n.urnInput.date,
    number: n.urnInput.number,
  });
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  console.log("═══ CORPUS SEED MINIMAL LEGAL ═══");
  console.log(`dry-run : ${flags.dryRun}`);
  console.log(`no-embed: ${flags.noEmbed}`);
  console.log("");

  const before = {
    norms: await prisma.legalNorm.count(),
    versions: await prisma.legalNormVersion.count(),
    chunks: await prisma.legalChunk.count(),
    citations: await prisma.legalCitation.count(),
  };
  console.log("Antes:");
  console.log(`  LegalNorm        : ${before.norms}`);
  console.log(`  LegalNormVersion : ${before.versions}`);
  console.log(`  LegalChunk       : ${before.chunks}`);
  console.log(`  LegalCitation    : ${before.citations}`);
  console.log("");

  const plan = MINIMAL_LEGAL_NORMS.map((n) => ({
    urn: buildUrn(n),
    title: n.title,
    bodyChars: n.body.length,
    sourceUrl: n.sourceUrl,
    kind: n.kind,
  }));

  console.log("Plano:");
  for (const p of plan) {
    console.log(`  • ${p.urn}`);
    console.log(`     ${p.title}  (${p.bodyChars} chars, ${p.kind})`);
  }
  console.log("");

  if (flags.dryRun) {
    console.log("--dry-run: nenhuma persistência. Saindo.");
    return;
  }

  const versionIds: string[] = [];
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalChunks = 0;

  for (const n of MINIMAL_LEGAL_NORMS) {
    const urn = buildUrn(n);
    const publishedAt = new Date(`${n.publishedAt}T00:00:00Z`);
    const result = await upsertCorpusPayload(
      {
        candidate: {
          urn,
          kind: n.kind,
          title: n.title,
          identifier: n.identifier,
          authority: n.authorityName,
          language: "pt-BR",
          tags: ["corpus.minimal", "manual.verified"],
          publishedAt,
          effectiveAt: publishedAt,
          sourceUrl: n.sourceUrl,
          sourceExternalId: `manual:${urn}`,
        },
        rawText: n.body,
      },
      { provider: CorpusProvider.MANUAL },
    );

    if (result.created) totalCreated++;
    else totalUpdated++;
    if (result.versioned) versionIds.push(result.versionId);
    totalChunks += result.chunksUpserted;

    console.log(
      `  ✔ ${urn.padEnd(60)}  ${result.created ? "novo " : "atual"}  chunks+=${result.chunksUpserted}`,
    );
  }

  console.log("");
  console.log(`LegalNorm criadas: ${totalCreated}, atualizadas: ${totalUpdated}`);
  console.log(`Chunks gerados nesta execução: ${totalChunks}`);
  console.log(`Versões novas para embedar: ${versionIds.length}`);

  if (flags.noEmbed) {
    console.log("\n--no-embed: pulando indexação no Qdrant.");
    return;
  }

  if (versionIds.length === 0) {
    console.log("\nNenhuma versão nova — nada a indexar no Qdrant.");
    return;
  }

  console.log("\nIndexando no Qdrant (lex_corpus_norms)...");
  let totalEmbedded = 0;
  let totalEmbedErrors = 0;
  for (const versionId of versionIds) {
    try {
      const r = await embedAndUpsertNormVersion({ normVersionId: versionId });
      totalEmbedded += r.chunksProcessed;
      totalEmbedErrors += r.errors;
      console.log(
        `  ✔ version ${versionId}  processed=${r.chunksProcessed}  errors=${r.errors}  ${r.durationMs}ms`,
      );
    } catch (err) {
      totalEmbedErrors++;
      console.error(`  ✗ version ${versionId} falhou:`, (err as Error).message);
    }
  }

  console.log("");

  const after = {
    norms: await prisma.legalNorm.count(),
    versions: await prisma.legalNormVersion.count(),
    chunks: await prisma.legalChunk.count(),
    citations: await prisma.legalCitation.count(),
  };
  console.log("Depois:");
  console.log(`  LegalNorm        : ${after.norms}  (Δ ${after.norms - before.norms})`);
  console.log(`  LegalNormVersion : ${after.versions}  (Δ ${after.versions - before.versions})`);
  console.log(`  LegalChunk       : ${after.chunks}  (Δ ${after.chunks - before.chunks})`);
  console.log(`  LegalCitation    : ${after.citations}  (Δ ${after.citations - before.citations})`);
  console.log(`  Qdrant upserts   : ${totalEmbedded}  errors=${totalEmbedErrors}`);

  // Critério mínimo
  const okNorms = after.norms >= 6;
  const okChunks = after.chunks >= 20;
  if (okNorms && okChunks) {
    console.log("\n✅ Critério mínimo atingido (LegalNorm >= 6, LegalChunk >= 20).");
  } else {
    console.log(
      `\n⚠ Critério mínimo NÃO atingido (norms=${after.norms} chunks=${after.chunks}).`,
    );
    process.exitCode = 1;
  }

  // Sanity: garantir que apenas legislação foi indexada (nada virou jurisprudência)
  const seeded = await prisma.legalNorm.findMany({
    where: { sourceProvider: CorpusProvider.MANUAL },
    select: { kind: true, urn: true },
  });
  const wrongCollection = seeded.filter(
    (n) =>
      n.kind === NormKind.JURISPRUDENCE_STF ||
      n.kind === NormKind.JURISPRUDENCE_STJ ||
      n.kind === NormKind.JURISPRUDENCE_TST ||
      n.kind === NormKind.JURISPRUDENCE_OTHER ||
      n.kind === NormKind.SUMULA_STF ||
      n.kind === NormKind.SUMULA_STJ ||
      n.kind === NormKind.SUMULA_VINCULANTE,
  );
  if (wrongCollection.length > 0) {
    console.log(
      `\n⚠ ${wrongCollection.length} norma(s) MANUAL com kind de jurisprudência (vão pra collection errada):`,
    );
    for (const w of wrongCollection) console.log(`     ${w.urn}  ${w.kind}`);
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
