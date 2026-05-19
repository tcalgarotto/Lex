/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  scheduleLangfuseFlush,
  withLangfuseRouteContext,
} from "@/lib/observability/langfuse-tracing";
import { CaseDraftStatus, CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listPinnedFoundations } from "@/lib/cases/drafting/case-brain-shim";
import { generateDraft } from "@/lib/cases/drafting/generate-draft";
import { enforceDraftingRateLimit } from "@/lib/cases/drafting/drafting-route-common";


const BodySchema = z.object({
  confirmUnverifiedFoundations: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId, draftId } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "draft-generate",
  });
  if (limited) return limited;

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detail: parsed.error.message }, { status: 400 });
  }

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const existing = await prisma.caseDraft.findFirst({
    where: { id: draftId, caseId },
  });
  if (!existing) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  scheduleLangfuseFlush();

  const out = await withLangfuseRouteContext(
    {
      traceName: "draft-regenerate",
      userId: user.id,
      workspaceId,
      caseId,
      inputSummary: JSON.stringify({ caseId, draftId }),
    },
    () =>
      generateDraft(caseId, workspaceId, {
        confirmUnverifiedFoundations: parsed.data.confirmUnverifiedFoundations === true,
      }),
  );

  if (out.status === "blocked") {
    return NextResponse.json({ status: "blocked", reasons: out.reasons }, { status: 409 });
  }

  const pins = await listPinnedFoundations(workspaceId, caseId);
  const groundingChunkIds = pins.map((p) => p.chunkId);

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.caseDraft.update({
      where: { id: existing.id },
      data: {
        content: out.content,
        status: CaseDraftStatus.GENERATED,
        groundingChunkIds,
        metadataJson: {
          ...((existing.metadataJson ?? {}) as Record<string, unknown>),
          foundationsUsed: out.foundationsUsed,
          inlineNotes: out.inlineNotes,
          generatedAt: new Date().toISOString(),
          generatedById: user.id,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.caseTimelineEvent.create({
      data: {
        caseId,
        kind: CaseTimelineKind.DRAFT_GENERATED,
        message: `Minuta v${d.version} gerada com guardas P0 (fundamentos pinados).`,
        userId: user.id,
        retrievalChunkIds: groundingChunkIds,
        payloadJson: {
          draftId: d.id,
          foundationsUsed: out.foundationsUsed,
        } as Prisma.InputJsonValue,
      },
    });
    return d;
  });

  return NextResponse.json({ draft: updated, inlineNotes: out.inlineNotes, foundationsUsed: out.foundationsUsed });
}
