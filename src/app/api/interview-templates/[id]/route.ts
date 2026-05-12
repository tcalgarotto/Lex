import { NextResponse } from "next/server";
import { z } from "zod";
import { MembershipRole, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";


const PatchBody = z.object({
  title: z.string().min(2).max(160).optional(),
  description: z.string().min(2).max(10_000).nullable().optional(),
  domain: z.string().min(2).max(80).nullable().optional(),
  schemaJson: z
    .unknown()
    .refine((v) => v !== null, "schemaJson não pode ser null")
    .optional(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { user, workspaceId } = await requireRole([
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.LAWYER,
  ]);
  const { id } = await context.params;

  const tpl = await prisma.interviewTemplate.findFirst({
    where: {
      id,
      workspaceId,
      OR: [{ scope: "WORKSPACE" }, { scope: "USER", ownerUserId: user.id }],
    },
  });
  if (!tpl) return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });

  return NextResponse.json({ template: tpl });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { user, workspaceId, role } = await requireRole([
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.LAWYER,
  ]);
  const { id } = await context.params;

  const existing = await prisma.interviewTemplate.findFirst({
    where: { id, workspaceId },
    select: { id: true, scope: true, ownerUserId: true },
  });
  if (!existing) return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });

  // Templates do workspace: só ADMIN/OWNER. Templates USER: só o dono (ou ADMIN/OWNER).
  if (existing.scope === "WORKSPACE") {
    if (role !== MembershipRole.ADMIN && role !== MembershipRole.OWNER) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }
  } else {
    const isOwner = existing.ownerUserId && existing.ownerUserId === user.id;
    const isPrivileged = role === MembershipRole.ADMIN || role === MembershipRole.OWNER;
    if (!isOwner && !isPrivileged) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const updated = await prisma.interviewTemplate.update({
    where: { id },
    data: {
      ...(typeof parsed.data.title === "string" ? { title: parsed.data.title } : {}),
      ...(typeof parsed.data.description === "string"
        ? { description: parsed.data.description }
        : parsed.data.description === null
          ? { description: null }
          : {}),
      ...(typeof parsed.data.domain === "string"
        ? { domain: parsed.data.domain }
        : parsed.data.domain === null
          ? { domain: null }
          : {}),
      ...(typeof parsed.data.schemaJson !== "undefined"
        ? { schemaJson: parsed.data.schemaJson as Prisma.InputJsonValue }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, template: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { user, workspaceId, role } = await requireRole([
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.LAWYER,
  ]);
  const { id } = await context.params;

  const existing = await prisma.interviewTemplate.findFirst({
    where: { id, workspaceId },
    select: { id: true, scope: true, ownerUserId: true },
  });
  if (!existing) return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });

  if (existing.scope === "WORKSPACE") {
    if (role !== MembershipRole.ADMIN && role !== MembershipRole.OWNER) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }
  } else {
    const isOwner = existing.ownerUserId && existing.ownerUserId === user.id;
    const isPrivileged = role === MembershipRole.ADMIN || role === MembershipRole.OWNER;
    if (!isOwner && !isPrivileged) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }
  }

  await prisma.interviewTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

