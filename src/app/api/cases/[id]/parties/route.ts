import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { touchCaseBrainFingerprintAfterMutation } from "@/lib/cases/case-brain/fingerprint";
import { recordCaseMutationActivity } from "@/lib/cases/case-brain/activity-log";


async function ensureCase(workspaceId: string, caseId: string) {
  const c = await findCaseInWorkspace(workspaceId, caseId);
  return c?.id ?? null;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const postSchema = z.object({
  role: z.enum(["AUTHOR", "DEFENDANT", "INTERVENING", "OTHER"]),
  kind: z.enum(["PERSON", "COMPANY", "PUBLIC_ENTITY", "UNKNOWN"]).optional(),
  name: z.string().min(2).max(300),
  document: z.string().min(3).max(40).optional(),
  phone: z.string().min(6).max(40).optional(),
  address: z.string().min(4).max(500).optional(),
  notes: z.string().min(1).max(2000).optional(),
  origem: z.string().min(1).max(60).optional(),
  source: z.string().min(1).max(60).optional(),
  status: z.string().min(1).max(40).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
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

const deleteSchema = z.object({ id: z.string().cuid() });

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const parties = await prisma.caseParty.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ parties });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const metadata: Record<string, unknown> = {
    origem: parsed.data.origem ?? parsed.data.source ?? "manual",
    source: parsed.data.source ?? "manual",
    status: parsed.data.status ?? "manual",
    confidence: parsed.data.confidence ?? 0.85,
  };
  if (parsed.data.phone) metadata["phone"] = parsed.data.phone;
  if (parsed.data.address) metadata["address"] = parsed.data.address;
  if (parsed.data.notes) metadata["notes"] = parsed.data.notes;

  const created = await prisma.caseParty.create({
    data: {
      caseId,
      role: parsed.data.role,
      kind: parsed.data.kind ?? "UNKNOWN",
      name: parsed.data.name,
      ...(parsed.data.document ? { document: parsed.data.document } : {}),
      metadataJson: metadata as Prisma.InputJsonValue,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Parte adicionada: ${created.name}`,
      payloadJson: { entity: "party", action: "create", partyId: created.id },
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
    kind: "case.party.create",
    title: "Parte criada",
    meta: { caseId, partyId: created.id },
  });

  return NextResponse.json({ ok: true, party: created }, { status: 201 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.caseParty.findFirst({
    where: { id: parsed.data.id, caseId },
    select: { id: true, metadataJson: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Parte não encontrada" }, { status: 404 });
  }

  const meta = { ...asObject(existing.metadataJson) };
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
  if (parsed.data.origem !== undefined) {
    if (parsed.data.origem === null) delete meta["origem"];
    else meta["origem"] = parsed.data.origem;
  }
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
      ...(parsed.data.document !== undefined
        ? { document: parsed.data.document ?? null }
        : {}),
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

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.caseParty.findFirst({
    where: { id: parsed.data.id, caseId },
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

