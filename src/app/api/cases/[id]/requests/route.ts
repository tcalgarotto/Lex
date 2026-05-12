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
  kind: z.enum(["MAIN", "SUBSIDIARY", "URGENCY", "PROVISIONAL", "EVIDENCE", "PROCEDURAL", "OTHER"])
    .optional(),
  text: z.string().min(2).max(50_000),
  legalBasisUrn: z.string().min(3).max(300).optional(),
  origem: z.string().min(1).max(60).optional(),
  source: z.string().min(1).max(60).optional(),
  status: z.string().min(1).max(40).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  kind: z
    .enum(["MAIN", "SUBSIDIARY", "URGENCY", "PROVISIONAL", "EVIDENCE", "PROCEDURAL", "OTHER"])
    .optional(),
  text: z.string().min(2).max(50_000).optional(),
  legalBasisUrn: z.string().min(3).max(300).nullable().optional(),
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
  const requests = await prisma.caseRequest.findMany({
    where: { caseId },
    orderBy: { ordinal: "asc" },
  });
  return NextResponse.json({ requests });
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

  const last = await prisma.caseRequest.findFirst({
    where: { caseId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  const ordinal = (last?.ordinal ?? 0) + 1;

  const metadata: Record<string, unknown> = {
    origem: parsed.data.origem ?? parsed.data.source ?? "manual",
    source: parsed.data.source ?? "manual",
    status: parsed.data.status ?? "manual",
    confidence: parsed.data.confidence ?? 0.8,
  };

  const created = await prisma.caseRequest.create({
    data: {
      caseId,
      ordinal,
      kind: parsed.data.kind ?? "MAIN",
      text: parsed.data.text,
      ...(parsed.data.legalBasisUrn ? { legalBasisUrn: parsed.data.legalBasisUrn } : {}),
      metadataJson: metadata as Prisma.InputJsonValue,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Pedido adicionado (#${String(created.ordinal).padStart(2, "0")})`,
      payloadJson: { entity: "request", action: "create", requestId: created.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_request" } });
  } catch {
    /* noop */
  }

  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.request.create",
    title: "Pedido criado",
    meta: { caseId, requestId: created.id },
  });

  return NextResponse.json({ ok: true, request: created }, { status: 201 });
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

  const existing = await prisma.caseRequest.findFirst({
    where: { id: parsed.data.id, caseId },
    select: { id: true, metadataJson: true, ordinal: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
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
  if (parsed.data.origem !== undefined) {
    if (parsed.data.origem === null) delete meta["origem"];
    else meta["origem"] = parsed.data.origem;
  }
  if (typeof parsed.data.confidence === "number") meta["confidence"] = parsed.data.confidence;
  if (parsed.data.markManual) {
    meta["lockedByUser"] = true;
    meta["origem"] = "manual";
    meta["status"] = "manual";
  }
  if (typeof parsed.data.lockedByUser === "boolean") meta["lockedByUser"] = parsed.data.lockedByUser;

  const updated = await prisma.caseRequest.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.text ? { text: parsed.data.text } : {}),
      ...(parsed.data.legalBasisUrn !== undefined
        ? { legalBasisUrn: parsed.data.legalBasisUrn ?? null }
        : {}),
      metadataJson: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Pedido atualizado (#${String(existing.ordinal).padStart(2, "0")})`,
      payloadJson: { entity: "request", action: "update", requestId: updated.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_request" } });
  } catch {
    /* noop */
  }

  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.request.update",
    title: "Pedido atualizado",
    meta: { caseId, requestId: updated.id },
  });

  return NextResponse.json({ ok: true, request: updated });
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

  const existing = await prisma.caseRequest.findFirst({
    where: { id: parsed.data.id, caseId },
    select: { id: true, ordinal: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  await prisma.caseRequest.delete({ where: { id: existing.id } });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Pedido removido (#${String(existing.ordinal).padStart(2, "0")})`,
      payloadJson: { entity: "request", action: "delete", requestId: existing.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_request" } });
  } catch {
    /* noop */
  }

  await touchCaseBrainFingerprintAfterMutation(caseId, workspaceId);
  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.request.delete",
    title: "Pedido removido",
    meta: { caseId, requestId: existing.id },
  });

  return NextResponse.json({ ok: true });
}

