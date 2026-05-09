/**
 * `npm run corpus:rechunk:articles -- --articles=Art.5,Art.7,Art.37,Art.205,Art.208,Art.227,Art.196,Art.198`
 *
 * Re-chunka artigos longos da CF/88 (e outras normas) usando o chunker v3
 * (F3.5), que recorta filhos por inciso/§/alínea. Idempotente:
 *  - Mantém o chunk-pai existente (não deleta para não quebrar
 *    `vectorPointId` válidos).
 *  - Cria filhos só quando ainda não existem (`contentHash` único por
 *    norma+versão).
 *  - Re-embed só dos novos filhos (pipeline já pula chunks com
 *    `vectorPointId` definido).
 *
 * Suporta `--dry-run` para inspecionar antes de mexer no Postgres.
 *
 * Argumentos:
 *  --articles=Art.5,Art.7    Lista CSV de artigos canônicos a recortar.
 *                            Default: cobertura típica do briefing creche.
 *  --norm=urn:lex:...        Restringe a uma norma específica. Default: CF/88.
 *  --dry-run                 Apenas relata o que faria.
 *  --no-embed                Insere chunks sem embed (rodar reindex depois).
 */

import "../src/lib/env-normalize";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { chunkLegalNormV3 } from "../src/lib/corpus/legal-chunker-v3";
import { embedAndUpsertNormVersion } from "../src/lib/corpus/embeddings-pipeline";

const DEFAULT_ARTICLES = [
  "Art. 5",
  "Art. 7",
  "Art. 37",
  "Art. 205",
  "Art. 208",
  "Art. 227",
  "Art. 196",
  "Art. 198",
];

function parseArgs(): {
  articles: string[];
  normUrn: string | null;
  dryRun: boolean;
  noEmbed: boolean;
} {
  const args = process.argv.slice(2);
  const out = {
    articles: DEFAULT_ARTICLES,
    normUrn: null as string | null,
    dryRun: false,
    noEmbed: false,
  };
  for (const a of args) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-embed") out.noEmbed = true;
    else if (a.startsWith("--articles=")) {
      out.articles = a
        .slice("--articles=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith("--norm=")) {
      out.normUrn = a.slice("--norm=".length).trim();
    }
  }
  return out;
}

function normalizeArticleKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ºo°]/g, "")
    .replace(/\s+/g, "")
    .replace(/^artigo/, "art")
    .replace(/^art\./, "art");
}

async function main(): Promise<void> {
  const args = parseArgs();
  const targetSet = new Set(args.articles.map(normalizeArticleKey));

  console.log("═══ CORPUS RECHUNK v3 ═══");
  console.log(`Artigos alvo: ${args.articles.join(", ")}`);
  console.log(`Norma: ${args.normUrn ?? "(default = qualquer norma com esses artigos)"}`);
  console.log(`Dry-run: ${args.dryRun}`);
  console.log(`No-embed: ${args.noEmbed}`);
  console.log("");

  const norms = await prisma.legalNorm.findMany({
    where: args.normUrn ? { urn: args.normUrn } : {},
    select: { id: true, urn: true, title: true, identifier: true },
    orderBy: { createdAt: "asc" },
  });

  if (norms.length === 0) {
    console.log("Nenhuma norma encontrada com esses critérios.");
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  const versionsToReindex = new Set<string>();

  for (const norm of norms) {
    const versions = await prisma.legalNormVersion.findMany({
      where: { normId: norm.id },
      select: { id: true, validFrom: true },
      orderBy: { validFrom: "desc" },
    });
    if (versions.length === 0) continue;
    const latest = versions[0]!;

    const parents = await prisma.legalChunk.findMany({
      where: { normVersionId: latest.id, structure: "ARTIGO" },
      select: {
        id: true,
        articleRef: true,
        text: true,
        fullPath: true,
        ordinal: true,
      },
      orderBy: { ordinal: "asc" },
    });

    const matching = parents.filter(
      (p) => p.articleRef && targetSet.has(normalizeArticleKey(p.articleRef)),
    );
    if (matching.length === 0) continue;

    console.log(`• ${norm.identifier ?? norm.title} (${norm.urn})`);
    console.log(
      `  ${matching.length} artigo(s) alvo encontrados na versão ${latest.id}`,
    );

    for (const parent of matching) {
      // Roda chunker v3 sobre o texto do pai, gera filhos.
      const v3 = chunkLegalNormV3(parent.text);
      const children = v3.filter((c) => c.isChild);
      if (children.length === 0) {
        console.log(`   - ${parent.articleRef}: nada a recortar (texto curto)`);
        continue;
      }

      let createdHere = 0;
      let skippedHere = 0;
      // Calcula próximo ordinal disponível na versão.
      const existing = await prisma.legalChunk.findMany({
        where: { normVersionId: latest.id },
        select: { ordinal: true, contentHash: true },
      });
      const usedOrdinals = new Set(existing.map((e) => e.ordinal));
      const usedHashes = new Set(existing.map((e) => e.contentHash));
      let nextOrdinal = (Math.max(0, ...existing.map((e) => e.ordinal)) ?? 0) + 1;
      while (usedOrdinals.has(nextOrdinal)) nextOrdinal += 1;

      for (const child of children) {
        const contentHash = crypto
          .createHash("sha256")
          .update(child.text)
          .digest("hex");
        if (usedHashes.has(contentHash)) {
          skippedHere += 1;
          continue;
        }
        if (!args.dryRun) {
          await prisma.legalChunk.create({
            data: {
              normId: norm.id,
              normVersionId: latest.id,
              ordinal: nextOrdinal,
              structure: child.structure,
              text: child.text,
              contentHash,
              chunkerVersion: "v3",
              parentChunkId: parent.id,
              ...(child.articleRef ? { articleRef: child.articleRef } : {}),
              ...(child.paragraphRef ? { paragraphRef: child.paragraphRef } : {}),
              ...(child.incisoRef ? { incisoRef: child.incisoRef } : {}),
              ...(child.alineaRef ? { alineaRef: child.alineaRef } : {}),
              ...(child.fullPath ? { fullPath: child.fullPath } : {}),
              tokenEstimate: Math.ceil(child.text.length / 4),
            },
          });
          versionsToReindex.add(latest.id);
        }
        usedOrdinals.add(nextOrdinal);
        usedHashes.add(contentHash);
        nextOrdinal += 1;
        while (usedOrdinals.has(nextOrdinal)) nextOrdinal += 1;
        createdHere += 1;
      }

      console.log(
        `   - ${parent.articleRef}: criados=${createdHere}, pulados=${skippedHere} (já existem)`,
      );
      totalCreated += createdHere;
      totalSkipped += skippedHere;
    }
  }

  console.log("");
  console.log(
    `Total: criados=${totalCreated}, pulados=${totalSkipped}, versões a reindexar=${versionsToReindex.size}`,
  );

  if (args.dryRun) {
    console.log("(dry-run: nenhuma escrita ocorreu)");
    return;
  }

  if (args.noEmbed || versionsToReindex.size === 0) {
    return;
  }

  console.log("");
  console.log(`Reindexando ${versionsToReindex.size} versão(ões)…`);
  for (const versionId of versionsToReindex) {
    try {
      const r = await embedAndUpsertNormVersion({ normVersionId: versionId });
      console.log(
        `  ✓ ${versionId}: processed=${r.chunksProcessed} skipped=${r.chunksSkipped} errors=${r.errors} ${r.durationMs}ms`,
      );
    } catch (err) {
      console.error(`  ✗ ${versionId}: ${(err as Error).message}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
