/**
 * F5 — Edição de minuta (cria nova versão a partir de uma existente).
 *
 * PATCH /api/cases/[id]/drafts/[draftId]
 *
 * Body: { content: string }
 *
 * Comportamento:
 *  - Não muta a versão original (auditável). Cria uma nova versão N+1 com
 *    `status = EDITED`, herda groundingChunkIds e adiciona `editedFromVersion`
 *    no metadataJson.
 *  - Insere evento `DRAFT_EDITED` na timeline.
 *  - Retorna a nova versão completa.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseDraftStatus, CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  content: z
    .string()
    .min(50, "Minuta muito curta (mínimo 50 caracteres).")
    .max(200_000, "Minuta excede o limite máximo (200k caracteres)."),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await params;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Body inválido", detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Garante que o caso pertence ao workspace e o draft pertence ao caso.
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const original = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
    select: {
      id: true,
      version: true,
      groundingChunkIds: true,
      metadataJson: true,
    },
  });
  if (!original) {
    return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  }

  // Cria nova versão.
  const newDraft = await prisma.$transaction(async (tx) => {
    const last = await tx.caseDraft.findFirst({
      where: { caseId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const newVersion = (last?.version ?? 0) + 1;

    const baseMeta = (original.metadataJson ?? {}) as Record<string, unknown>;
    const meta = {
      ...baseMeta,
      editedFromVersion: original.version,
      editedById: user.id,
      editedAt: new Date().toISOString(),
    };

    const created = await tx.caseDraft.create({
      data: {
        caseId,
        version: newVersion,
        status: CaseDraftStatus.EDITED,
        content: body.content,
        groundingChunkIds: original.groundingChunkIds,
        metadataJson: meta as Prisma.InputJsonValue,
      },
    });

    await tx.caseTimelineEvent.create({
      data: {
        caseId,
        kind: CaseTimelineKind.DRAFT_EDITED,
        message: `Minuta v${newVersion} editada manualmente (a partir de v${original.version}).`,
        userId: user.id,
        retrievalChunkIds: original.groundingChunkIds,
        payloadJson: {
          fromVersion: original.version,
          toVersion: newVersion,
          chars: body.content.length,
        } as Prisma.InputJsonValue,
      },
    });
    return created;
  });

  return NextResponse.json(
    {
      ok: true,
      draft: newDraft,
    },
    { status: 201 },
  );
}
