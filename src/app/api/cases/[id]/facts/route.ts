import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

async function ensureCase(workspaceId: string, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  return c?.id ?? null;
}

const postSchema = z.object({
  text: z.string().min(2).max(50_000),
  category: z.string().min(1).max(60).optional(),
  dates: z.array(z.string().min(4).max(20)).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  text: z.string().min(2).max(50_000).optional(),
  category: z.string().min(1).max(60).nullable().optional(),
  dates: z.array(z.string().min(4).max(20)).optional(),
  confidence: z.number().min(0).max(1).optional(),
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

  const created = await prisma.caseFact.create({
    data: {
      caseId,
      ordinal,
      text: parsed.data.text,
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.dates ? { dates: parsed.data.dates } : {}),
      ...(typeof parsed.data.confidence === "number" ? { confidence: parsed.data.confidence } : {}),
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
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Fato não encontrado" }, { status: 404 });
  }

  const updated = await prisma.caseFact.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.text ? { text: parsed.data.text } : {}),
      ...(parsed.data.category !== undefined
        ? { category: parsed.data.category ?? null }
        : {}),
      ...(parsed.data.dates ? { dates: parsed.data.dates } : {}),
      ...(typeof parsed.data.confidence === "number" ? { confidence: parsed.data.confidence } : {}),
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

  return NextResponse.json({ ok: true });
}

