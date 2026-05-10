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
  role: z.enum(["AUTHOR", "DEFENDANT", "INTERVENING", "OTHER"]).optional(),
  kind: z.enum(["PERSON", "COMPANY", "PUBLIC_ENTITY", "UNKNOWN"]).optional(),
  name: z.string().min(2).max(300).optional(),
  document: z.string().min(3).max(40).nullable().optional(),
  phone: z.string().min(6).max(40).nullable().optional(),
  address: z.string().min(4).max(500).nullable().optional(),
  notes: z.string().min(1).max(2000).nullable().optional(),
  origem: z.string().min(1).max(60).nullable().optional(),
  source: z.string().min(1).max(60).nullable().optional(),
  status: z.string().min(1).max(40).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  lockedByUser: z.boolean().optional(),
  markManual: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; partyId: string }> },
) {
  const { id: caseId, partyId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.caseParty.findFirst({
    where: { id: partyId, caseId },
    select: { id: true, metadataJson: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Parte não encontrada" }, { status: 404 });
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
  if (parsed.data.phone !== undefined) {
    if (parsed.data.phone === null) delete meta["phone"];
    else meta["phone"] = parsed.data.phone;
  }
  if (parsed.data.address !== undefined) {
    if (parsed.data.address === null) delete meta["address"];
    else meta["address"] = parsed.data.address;
  }
  if (parsed.data.notes !== undefined) {
    if (parsed.data.notes === null) delete meta["notes"];
    else meta["notes"] = parsed.data.notes;
  }
  if (typeof parsed.data.confidence === "number") meta["confidence"] = parsed.data.confidence;
  if (parsed.data.markManual) {
    meta["lockedByUser"] = true;
    meta["origem"] = "manual";
    meta["status"] = "manual";
  }
  if (typeof parsed.data.lockedByUser === "boolean") meta["lockedByUser"] = parsed.data.lockedByUser;

  const updated = await prisma.caseParty.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.document !== undefined ? { document: parsed.data.document ?? null } : {}),
      metadataJson: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Parte atualizada: ${updated.name}`,
      payloadJson: { entity: "party", action: "update", partyId: updated.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_party" } });
  } catch {
    /* noop */
  }
  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.party.update",
    title: "Parte atualizada",
    meta: { caseId, partyId: updated.id },
  });

  return NextResponse.json({ ok: true, party: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; partyId: string }> },
) {
  const { id: caseId, partyId } = await params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const existing = await prisma.caseParty.findFirst({
    where: { id: partyId, caseId },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Parte não encontrada" }, { status: 404 });
  }

  await prisma.caseParty.delete({ where: { id: existing.id } });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Parte removida: ${existing.name}`,
      payloadJson: { entity: "party", action: "delete", partyId: existing.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_party" } });
  } catch {
    /* noop */
  }
  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.party.delete",
    title: "Parte removida",
    meta: { caseId, partyId: existing.id },
  });

  return NextResponse.json({ ok: true });
}
