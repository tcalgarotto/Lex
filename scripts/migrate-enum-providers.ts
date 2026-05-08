/**
 * Migra o enum CorpusProvider adicionando `CAMARA` e `SENADO`.
 *
 * Por que esse script existe:
 *  - `prisma db push` falha em LegalChunk.textTsv (coluna `tsvector` GENERATED).
 *    O Prisma não suporta ALTER em colunas geradas — bug conhecido.
 *  - Para adicionar valores ao enum não precisamos tocar em tabela alguma:
 *    `ALTER TYPE ... ADD VALUE IF NOT EXISTS` é DDL atômico, idempotente.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/migrate-enum-providers.ts
 *
 * Em produção (com a env correta carregada via vercel pull ou export):
 *   DATABASE_URL=... npx tsx scripts/migrate-enum-providers.ts
 *
 * O script é idempotente — pode rodar quantas vezes quiser. Já existindo,
 * o `IF NOT EXISTS` apenas pula.
 */

/* eslint-disable no-console */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALUES_TO_ADD = ["CAMARA", "SENADO"] as const;

async function main(): Promise<void> {
  console.log(
    "▸ Adicionando valores ao enum CorpusProvider:",
    VALUES_TO_ADD.join(", "),
  );

  for (const value of VALUES_TO_ADD) {
    // ALTER TYPE ADD VALUE não pode rodar dentro de transação se o valor
    // for usado na mesma transação. $executeRawUnsafe envia statement isolado.
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "CorpusProvider" ADD VALUE IF NOT EXISTS '${value}'`,
    );
    console.log(`  ✓ ${value}`);
  }

  // Verificação: lista os valores atuais do enum.
  type EnumRow = { enumlabel: string };
  const rows = await prisma.$queryRawUnsafe<EnumRow[]>(`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'CorpusProvider'
    ORDER BY e.enumsortorder
  `);

  console.log("\n▸ Estado atual do enum CorpusProvider:");
  for (const r of rows) console.log(`  - ${r.enumlabel}`);

  const labels = new Set(rows.map((r) => r.enumlabel));
  const missing = VALUES_TO_ADD.filter((v) => !labels.has(v));
  if (missing.length > 0) {
    console.error("\n❌ Valores ainda ausentes:", missing.join(", "));
    process.exitCode = 1;
    return;
  }

  console.log("\n✅ Migração concluída.");
}

main()
  .catch((err) => {
    console.error("❌ Migração falhou:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
