import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().min(3).optional(),
  contentMd: z.string().min(10).optional(),
  tags: z.array(z.string().min(1)).optional(),
  optInRag: z.boolean().optional(),
  optInMemory: z.boolean().optional(),
  useAsModel: z.boolean().optional(),
  useAsStyle: z.boolean().optional(),
  archived: z.boolean().optional(),
  sourceJson: z.unknown().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;

  const f = await prisma.libraryFoundation.findFirst({
    where: { id, workspaceId, deletedAt: null },
    select: {
      id: true,
      title: true,
      contentMd: true,
      tags: true,
      scope: true,
      ownerUserId: true,
      optInRag: true,
      optInMemory: true,
      useAsModel: true,
      useAsStyle: true,
      archivedAt: true,
      sourceJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!f) return NextResponse.json({ error: "Fundamento não encontrado" }, { status: 404 });
  return NextResponse.json({ foundation: f });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;

  const existing = await prisma.libraryFoundation.findFirst({
    where: { id, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Fundamento não encontrado" }, { status: 404 });

  const body = PatchSchema.parse(await req.json());

  await prisma.libraryFoundation.update({
    where: { id },
    data: {
      ...(body.title ? { title: body.title } : {}),
      ...(body.contentMd ? { contentMd: body.contentMd } : {}),
      ...(body.tags ? { tags: body.tags } : {}),
      ...(typeof body.optInRag === "boolean" ? { optInRag: body.optInRag } : {}),
      ...(typeof body.optInMemory === "boolean" ? { optInMemory: body.optInMemory } : {}),
      ...(typeof body.useAsModel === "boolean" ? { useAsModel: body.useAsModel } : {}),
      ...(typeof body.useAsStyle === "boolean" ? { useAsStyle: body.useAsStyle } : {}),
      ...(typeof body.archived === "boolean" ? { archivedAt: body.archived ? new Date() : null } : {}),
      ...(body.sourceJson ? { sourceJson: body.sourceJson as Prisma.InputJsonValue } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const url = new URL(req.url);
  if (url.searchParams.get("confirm") !== "1") {
    return NextResponse.json({ error: "Confirmação obrigatória. Reenvie com ?confirm=1" }, { status: 400 });
  }

  const f = await prisma.libraryFoundation.findFirst({
    where: { id, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!f) return NextResponse.json({ error: "Fundamento não encontrado" }, { status: 404 });

  await prisma.libraryFoundation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

