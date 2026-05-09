import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const postSchema = z.object({
  kind: z.string().min(2).max(80),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  title: z.string().min(2).max(300),
  detail: z.string().min(2).max(50_000),
  evidenceNormUrns: z.array(z.string().min(3).max(400)).optional(),
  evidenceChunkIds: z.array(z.string().min(3).max(120)).optional(),
  source: z.string().min(1).max(60).optional(),
  status: z.string().min(1).max(40).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  kind: z.string().min(2).max(80).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  title: z.string().min(2).max(300).optional(),
  detail: z.string().min(2).max(50_000).optional(),
  evidenceNormUrns: z.array(z.string().min(3).max(400)).optional(),
  evidenceChunkIds: z.array(z.string().min(3).max(120)).optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  resolvedById: z.string().min(3).max(120).nullable().optional(),
  source: z.string().min(1).max(60).nullable().optional(),
  status: z.string().min(1).max(40).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const deleteSchema = z.object({ id: z.string().cuid() });

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  if (!(await ensureCase(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const risks = await prisma.caseRisk.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ risks });
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
    source: parsed.data.source ?? "manual",
    status: parsed.data.status ?? "editado",
    confidence: parsed.data.confidence ?? 0.75,
  };

  const created = await prisma.caseRisk.create({
    data: {
      caseId,
      kind: parsed.data.kind as never,
      severity: parsed.data.severity,
      title: parsed.data.title,
      detail: parsed.data.detail,
      evidenceNormUrns: parsed.data.evidenceNormUrns ?? [],
      evidenceChunkIds: parsed.data.evidenceChunkIds ?? [],
      metadataJson: metadata as Prisma.InputJsonValue,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: "NOTE",
      message: `Risco adicionado: ${created.title}`,
      payloadJson: { entity: "risk", action: "create", riskId: created.id },
      ...(user?.id ? { userId: user.id } : {}),
    },
  });

  try {
    await inngest.send({ name: "lex/case.brain", data: { caseId, source: "manual_risk" } });
  } catch {
    /* noop */
  }

  return NextResponse.json({ ok: true, risk: created }, { status: 201 });
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

  const existing = await prisma.caseRisk.findFirst({
    where: { id: parsed.data.id, caseId },
    select: { id: true, metadataJson: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Risco não encontrado" }, { status: 404 });
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
  if (typeof parsed.data.confidence === "number") meta["confidence"] = parsed.data.confidence;

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

  return NextResponse.json({ ok: true, risk: updated });
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

  const existing = await prisma.caseRisk.findFirst({
    where: { id: parsed.data.id, caseId },
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

  return NextResponse.json({ ok: true });
}

