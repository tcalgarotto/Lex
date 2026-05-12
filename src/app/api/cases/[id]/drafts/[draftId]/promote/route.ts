/**
 * POST /api/cases/[id]/drafts/[draftId]/promote
 * Promove CaseDraft (Markdown) para LegalPiece (editor TipTap).
 */

import { NextResponse } from "next/server";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { markdownToTipTapDoc } from "@/lib/cases/drafting/markdown-to-tiptap-doc";
import { enforceDraftingRateLimit } from "@/lib/cases/drafting/drafting-route-common";
import { getPieceModelId, getChatProviderId } from "@/lib/ai/llm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-promote",
  });
  if (limited) return limited;

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true, title: true, metadataJson: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const draft = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
  });
  if (!draft) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  const plain = draft.content?.trim() ?? "";
  if (plain.length < 80) {
    return NextResponse.json({ error: "Minuta vazia ou muito curta para promover." }, { status: 400 });
  }

  const meta = (draft.metadataJson ?? {}) as Record<string, unknown>;
  const title =
    typeof meta["promoteTitle"] === "string" && meta["promoteTitle"].trim()
      ? meta["promoteTitle"].trim()
      : `${c.title?.slice(0, 80) ?? "Peça"} — minuta v${draft.version}`;

  const kind = typeof meta["pieceKind"] === "string" && meta["pieceKind"].trim() ? meta["pieceKind"].trim() : "peticao";

  const contentJson = markdownToTipTapDoc(plain) as unknown as Prisma.InputJsonValue;

  const piece = await prisma.legalPiece.create({
    data: {
      workspaceId,
      processId: null,
      kind,
      title: title.slice(0, 500),
      contentJson,
      aiMetaJson: {
        source: "case_draft_promote",
        caseId,
        draftId: draft.id,
        draftVersion: draft.version,
        provider: getChatProviderId(),
        model: getPieceModelId(),
        promotedAt: new Date().toISOString(),
        promotedByUserId: user.id,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: CaseTimelineKind.DRAFT_EDITED,
      message: `Minuta promovida ao editor avançado (peça ${piece.id}).`,
      userId: user.id,
      payloadJson: { pieceId: piece.id, draftId: draft.id } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ pieceId: piece.id, title: piece.title }, { status: 201 });
}
