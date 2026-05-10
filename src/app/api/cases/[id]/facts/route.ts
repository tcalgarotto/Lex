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

async function ensureCase(workspaceId: string, caseId: string) {
  const c = await findCaseInWorkspace(workspaceId, caseId);
  return c?.id ?? null;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const postSchema = z.object({
  text: z.string().min(2).max(50_000),
  category: z.string().min(1).max(60).optional(),
  dates: z.array(z.string().min(4).max(20)).optional(),
  confidence: z.number().min(0).max(1).optional(),
  origem: z.string().min(1).max(60).optional(),
  status: z.string().min(1).max(40).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  text: z.string().min(2).max(50_000).optional(),
  category: z.string().min(1).max(60).nullable().optional(),
  dates: z.array(z.string().min(4).max(20)).optional(),
  confidence: z.number().min(0).max(1).optional(),
  origem: z.string().min(1).max(60).nullable().optional(),
  status: z.string().min(1).max(40).nullable().optional(),
  lockedByUser: z.boolean().optional(),
  markManual: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.string().cuid(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const facts = await prisma.caseFact.findMany({
    where: { caseId },
    orderBy: { ordinal: "asc" },
  });
  return NextResponse.json({ facts });
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

  const last = await prisma.caseFact.findFirst({
    where: { caseId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  const ordinal = (last?.ordinal ?? 0) + 1;

  const conf = typeof parsed.data.confidence === "number" ? parsed.data.confidence : 0.85;
  const meta: Record<string, unknown> = {
    origem: parsed.data.origem ?? "manual",
    status: parsed.data.status ?? "manual",
    confidence: conf,
  };

  const created = await prisma.caseFact.create({
    data: {
      caseId,
      ordinal,
      text: parsed.data.text,
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.dates ? { dates: parsed.data.dates } : {}),
      confidence: conf,
      metadataJson: meta as Prisma.InputJsonValue,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Fato adicionado (#${String(created.ordinal).padStart(2, "0")})`,
      payloadJson: { entity: "fact", action: "create", factId: created.id },
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
    kind: "case.fact.create",
    title: "Fato criado",
    meta: { caseId, factId: created.id },
  });

  return NextResponse.json({ ok: true, fact: created }, { status: 201 });
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

  const existing = await prisma.caseFact.findFirst({
    where: { id: parsed.data.id, caseId },
    select: { id: true, metadataJson: true },
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
      ...(parsed.data.category !== undefined
        ? { category: parsed.data.category ?? null }
        : {}),
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

  const existing = await prisma.caseFact.findFirst({
    where: { id: parsed.data.id, caseId },
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

