/**
 * Audita cobertura: compara artigos esperados (do parser semântico) vs
 * articleRefs únicos persistidos no DB. Evidencia gaps causados pelo
 * chunker.
 *
 *   npx tsx scripts/cf-coverage-audit.ts
 */
import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { loadParsedConstitution } from "../src/lib/corpus/providers/markdown-cf";

async function main(): Promise<void> {
  const { parsed } = await loadParsedConstitution();

  // Esperado: pares (codigo, ref).
  const expected = new Set<string>();
  for (const a of parsed.articles) {
    const codigo = a.segment === "ADCT" ? "ADCT" : "CF";
    expected.add(`${codigo}|${a.ref}`);
  }

  // Persistido: pares (codigo, ref) lidos do DB.
  const chunks = await prisma.legalChunk.findMany({
    select: { articleRef: true, metadataJson: true },
  });
  const persisted = new Set<string>();
  let chunksWithoutRef = 0;
  let chunksWithoutCodigo = 0;
  for (const c of chunks) {
    if (!c.articleRef) {
      chunksWithoutRef++;
      continue;
    }
    const md = c.metadataJson as { codigo?: string } | null;
    const codigo = md?.codigo;
    if (!codigo) {
      chunksWithoutCodigo++;
      continue;
    }
    persisted.add(`${codigo}|${c.articleRef}`);
  }

  const missing: string[] = [];
  for (const k of expected) if (!persisted.has(k)) missing.push(k);
  const extra: string[] = [];
  for (const k of persisted) if (!expected.has(k)) extra.push(k);

  console.log(`Esperado: ${expected.size} pares (codigo,ref)`);
  console.log(`Persistido: ${persisted.size} pares (codigo,ref)`);
  console.log(`Faltando: ${missing.length}`);
  console.log(`Extras (não esperado): ${extra.length}`);
  console.log(`Chunks sem articleRef: ${chunksWithoutRef}`);
  console.log(`Chunks sem codigo no metadata: ${chunksWithoutCodigo}`);
  console.log("");
  if (missing.length) {
    console.log("Faltando (até 60):");
    console.log("  " + missing.slice(0, 60).join(", "));
  }
  if (extra.length) {
    console.log("Extras (até 30):");
    console.log("  " + extra.slice(0, 30).join(", "));
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
