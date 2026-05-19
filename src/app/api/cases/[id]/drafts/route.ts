/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import {
  flushLangfuseTraces,
  withLangfuseRouteContext,
} from "@/lib/observability/langfuse-tracing";
import { CaseDraftStatus, CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getPieceModelId, getChatProviderId } from "@/lib/ai/llm";
import { listPinnedFoundations } from "@/lib/cases/drafting/case-brain-shim";
import { generateDraft } from "@/lib/cases/drafting/generate-draft";
import { enforceDraftingRateLimit, loadCaseScoped } from "@/lib/cases/drafting/drafting-route-common";
import { createHash } from "node:crypto";

const PostBodySchema = z.object({
  confirmUnverifiedFoundations: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "drafts-list",
  });
  if (limited) return limited;

  const c = await loadCaseScoped(workspaceId, id);
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const drafts = await prisma.caseDraft.findMany({
    where: { caseId: c.id },
    orderBy: { version: "desc" },
  });
  return NextResponse.json({ drafts });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  const limited = await enforceDraftingRateLimit({
    req,
    userId: user.id,
    bucket: "drafts-create",
  });
  if (limited) return limited;

  const c = await loadCaseScoped(workspaceId, id);
  if (!c) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

  const json = await req.json().catch(() => ({}));
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detail: parsed.error.message }, { status: 400 });
  }

  after(async () => {
    await flushLangfuseTraces();
  });

  const out = await withLangfuseRouteContext(
    {
      traceName: "draft-generation",
      userId: user.id,
      workspaceId,
      caseId: id,
      inputSummary: JSON.stringify({ caseId: id }),
    },
    () =>
      generateDraft(id, workspaceId, {
        confirmUnverifiedFoundations: parsed.data.confirmUnverifiedFoundations === true,
      }),
  );

  if (out.status === "blocked") {
    return NextResponse.json({ status: "blocked", reasons: out.reasons }, { status: 409 });
  }

  const pins = await listPinnedFoundations(workspaceId, id);
  const groundingChunkIds = pins.map((p) => p.chunkId);

  const last = await prisma.caseDraft.findFirst({
    where: { caseId: c.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const strat = meta["draftingStrategy"];
  const stratHash =
    strat !== undefined && strat !== null
      ? createHash("sha256").update(JSON.stringify(strat)).digest("hex").slice(0, 16)
      : null;

  const draft = await prisma.$transaction(async (tx) => {
    const d = await tx.caseDraft.create({
      data: {
        caseId: c.id,
        version,
        status: CaseDraftStatus.GENERATED,
        content: out.content,
        groundingChunkIds,
        metadataJson: {
          createdVia: "drafting-tab-p0",
          provider: getChatProviderId(),
          model: getPieceModelId(),
          promptVersion: "case-draft-generate-v1",
          generatedAt: new Date().toISOString(),
          generatedById: user.id,
          basedOnStrategyHash: stratHash,
          foundationsUsed: out.foundationsUsed,
          inlineNotes: out.inlineNotes,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.caseTimelineEvent.create({
      data: {
        caseId: c.id,
        kind: CaseTimelineKind.DRAFT_GENERATED,
        message: `Minuta v${version} gerada (Lex AI, guardas P0).`,
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

  return NextResponse.json({ draft, inlineNotes: out.inlineNotes, foundationsUsed: out.foundationsUsed }, { status: 201 });
}
