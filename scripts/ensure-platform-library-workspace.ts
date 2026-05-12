/**
 * Cria o workspace do catálogo global da Lex (slug `lex-platform-catalog`) se ainda não existir.
 * Os PDFs enviados pelo script `upload-leis-codigos-normas-to-library.ts` devem usar este workspace,
 * com `uploadedByUserId = null`, para não ficarem associados a uma conta pessoal.
 *
 *   npx tsx --env-file=.env scripts/ensure-platform-library-workspace.ts
 */

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { PLATFORM_LIBRARY_WORKSPACE_SLUG } from "../src/lib/biblioteca/platform-library";

async function main() {
  const existing = await prisma.workspace.findUnique({
    where: { slug: PLATFORM_LIBRARY_WORKSPACE_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (existing) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          message: "Workspace do catálogo global já existe.",
          workspace: existing,
          hint: `Defina LEX_PLATFORM_LIBRARY_WORKSPACE_ID=${existing.id} em produção se quiser fixar o ID.`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const created = await prisma.workspace.create({
    data: {
      name: "Lex — Catálogo global",
      slug: PLATFORM_LIBRARY_WORKSPACE_SLUG,
    },
    select: { id: true, name: true, slug: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "Workspace criado. Use este ID em LEX_PLATFORM_LIBRARY_WORKSPACE_ID (ou confie no slug).",
        workspace: created,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
