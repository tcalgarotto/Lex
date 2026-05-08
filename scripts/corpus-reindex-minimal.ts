/**
 * `npm run corpus:reindex:minimal`
 *
 * Re-embeda e re-indexa todas as `LegalNormVersion` cujas normas
 * têm `sourceProvider = MANUAL` (corpus mínimo verificado).
 *
 * Idempotente: chunks que já têm `vectorPointId` são pulados pelo
 * pipeline (`embedAndUpsertNormVersion`).
 *
 * Use depois de:
 *   - rodar `corpus:seed:minimal-legal` com `--no-embed`,
 *   - recriar a collection `lex_corpus_norms` (limpando vectorPointId),
 *   - alterar o esquema do payload.
 */

import "../src/lib/env-normalize";
import { CorpusProvider } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { embedAndUpsertNormVersion } from "../src/lib/corpus/embeddings-pipeline";

async function main(): Promise<void> {
  const norms = await prisma.legalNorm.findMany({
    where: {
      sourceProvider: { in: [CorpusProvider.MANUAL, CorpusProvider.PLANALTO] },
    },
    select: { id: true, urn: true, title: true, sourceProvider: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`═══ CORPUS REINDEX MINIMAL ═══`);
  console.log(`Normas MANUAL/PLANALTO: ${norms.length}`);
  console.log("");

  if (norms.length === 0) {
    console.log(
      "Nenhuma norma encontrada. Rode primeiro `npm run corpus:seed:minimal-legal` ou `npm run corpus:seed:official-laws`.",
    );
    return;
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const n of norms) {
    const versions = await prisma.legalNormVersion.findMany({
      where: { normId: n.id },
      select: { id: true, validFrom: true },
      orderBy: { validFrom: "desc" },
    });

    console.log(`• [${n.sourceProvider}] ${n.title}  (${versions.length} versão${versions.length === 1 ? "" : "s"})`);

    for (const v of versions) {
      try {
        const r = await embedAndUpsertNormVersion({ normVersionId: v.id });
        totalProcessed += r.chunksProcessed;
        totalErrors += r.errors;
        console.log(
          `   - ${v.id}  processed=${r.chunksProcessed}  errors=${r.errors}  ${r.durationMs}ms`,
        );
      } catch (err) {
        totalErrors++;
        console.error(`   - ${v.id} falhou:`, (err as Error).message);
      }
    }
  }

  console.log("");
  console.log(`Total: processed=${totalProcessed}  errors=${totalErrors}`);

  if (totalErrors > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
