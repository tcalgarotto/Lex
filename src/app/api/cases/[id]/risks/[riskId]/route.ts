/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { touchCaseBrainFingerprintAfterMutation } from "@/lib/cases/case-brain/fingerprint";
import { recordCaseMutationActivity } from "@/lib/cases/case-brain/activity-log";

export const dynamic = "force-dynamic";

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const patchSchema = z.object({
  kind: z.string().min(2).max(80).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  title: z.string().min(2).max(300).optional(),
  detail: z.string().min(2).max(50_000).optional(),
  evidenceNormUrns: z.array(z.string().min(3).max(400)).optional(),
  evidenceChunkIds: z.array(z.string().min(3).max(120)).optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  resolvedById: z.string().min(3).max(120).nullable().optional(),
  origem: z.string().min(1).max(60).nullable().optional(),
  source: z.string().min(1).max(60).nullable().optional(),
  status: z.string().min(1).max(40).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  lockedByUser: z.boolean().optional(),
  markManual: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  const { id: caseId, riskId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.caseRisk.findFirst({
    where: { id: riskId, caseId },
    select: { id: true, metadataJson: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Risco não encontrado" }, { status: 404 });
  }

  const meta = { ...asObject(existing.metadataJson) };
  if (parsed.data.origem !== undefined) {
    if (parsed.data.origem === null) delete meta["origem"];
    else meta["origem"] = parsed.data.origem;
  }
  if (parsed.data.source !== undefined) {
    if (parsed.data.source === null) delete meta["source"];
    else meta["source"] = parsed.data.source;
  }
  if (parsed.data.status !== undefined) {
    if (parsed.data.status === null) delete meta["status"];
    else meta["status"] = parsed.data.status;
  }
  if (typeof parsed.data.confidence === "number") meta["confidence"] = parsed.data.confidence;
  if (parsed.data.markManual) {
    meta["lockedByUser"] = true;
    meta["origem"] = "manual";
    meta["status"] = "manual";
  }
  if (typeof parsed.data.lockedByUser === "boolean") meta["lockedByUser"] = parsed.data.lockedByUser;

  const updated = await prisma.caseRisk.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.kind ? { kind: parsed.data.kind as never } : {}),
      ...(parsed.data.severity ? { severity: parsed.data.severity } : {}),
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.detail ? { detail: parsed.data.detail } : {}),
      ...(parsed.data.evidenceNormUrns ? { evidenceNormUrns: parsed.data.evidenceNormUrns } : {}),
      ...(parsed.data.evidenceChunkIds ? { evidenceChunkIds: parsed.data.evidenceChunkIds } : {}),
      ...(parsed.data.resolvedAt !== undefined
        ? { resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null }
        : {}),
      ...(parsed.data.resolvedById !== undefined ? { resolvedById: parsed.data.resolvedById ?? null } : {}),
      metadataJson: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Risco atualizado: ${updated.title}`,
      payloadJson: { entity: "risk", action: "update", riskId: updated.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_risk" } });
  } catch {
    /* noop */
  }
  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.risk.update",
    title: "Risco atualizado",
    meta: { caseId, riskId: updated.id },
  });

  return NextResponse.json({ ok: true, risk: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  const { id: caseId, riskId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const existing = await prisma.caseRisk.findFirst({
    where: { id: riskId, caseId },
    select: { id: true, title: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Risco não encontrado" }, { status: 404 });
  }

  await prisma.caseRisk.delete({ where: { id: existing.id } });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Risco removido: ${existing.title}`,
      payloadJson: { entity: "risk", action: "delete", riskId: existing.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_risk" } });
  } catch {
    /* noop */
  }
  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.risk.delete",
    title: "Risco removido",
    meta: { caseId, riskId: existing.id },
  });

  return NextResponse.json({ ok: true });
}
