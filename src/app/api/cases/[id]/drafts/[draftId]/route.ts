/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 *
 * GET — minuta por id.
 * PATCH (F5) — salva edição manual como nova versão auditável (não muta a anterior).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseDraftStatus, CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enforceDraftingRateLimit } from "@/lib/cases/drafting/drafting-route-common";


export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-get",
  });
  if (limited) return limited;

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const draft = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
  });
  if (!draft) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  return NextResponse.json({ draft });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-get",
  });
  if (limited) return limited;

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const draft = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
  });
  if (!draft) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  return NextResponse.json({ draft });
}

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

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-patch",
  });
  if (limited) return limited;

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
