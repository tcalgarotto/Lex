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


function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const patchSchema = z.object({
  text: z.string().min(2).max(50_000).optional(),
  category: z.string().min(1).max(60).nullable().optional(),
  dates: z.array(z.string().min(4).max(20)).optional(),
  confidence: z.number().min(0).max(1).optional(),
  origem: z.string().min(1).max(60).nullable().optional(),
  status: z.string().min(1).max(40).nullable().optional(),
  lockedByUser: z.boolean().optional(),
  markManual: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; factId: string }> },
) {
  const { id: caseId, factId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.caseFact.findFirst({
    where: { id: factId, caseId },
    select: { id: true, metadataJson: true, ordinal: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Fato não encontrado" }, { status: 404 });
  }

  const meta = { ...asObject(existing.metadataJson) };
  if (parsed.data.origem !== undefined) {
    if (parsed.data.origem === null) delete meta["origem"];
    else meta["origem"] = parsed.data.origem;
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

  const updated = await prisma.caseFact.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.text ? { text: parsed.data.text } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category ?? null } : {}),
      ...(parsed.data.dates ? { dates: parsed.data.dates } : {}),
      ...(typeof parsed.data.confidence === "number" ? { confidence: parsed.data.confidence } : {}),
      metadataJson: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Fato atualizado (#${String(updated.ordinal).padStart(2, "0")})`,
      payloadJson: { entity: "fact", action: "update", factId: updated.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_fact" } });
  } catch {
    /* noop */
  }
  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.fact.update",
    title: "Fato atualizado",
    meta: { caseId, factId: updated.id },
  });

  return NextResponse.json({ ok: true, fact: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; factId: string }> },
) {
  const { id: caseId, factId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const existing = await prisma.caseFact.findFirst({
    where: { id: factId, caseId },
    select: { id: true, ordinal: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Fato não encontrado" }, { status: 404 });
  }

  await prisma.caseFact.delete({ where: { id: existing.id } });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Fato removido (#${String(existing.ordinal).padStart(2, "0")})`,
      payloadJson: { entity: "fact", action: "delete", factId: existing.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_fact" } });
  } catch {
    /* noop */
  }
  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.fact.delete",
    title: "Fato removido",
    meta: { caseId, factId: existing.id },
  });

  return NextResponse.json({ ok: true });
}
