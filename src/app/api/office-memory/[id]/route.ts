import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officeMemoryReadableWhere } from "@/lib/office-memory/visibility";


const PatchSchema = z.object({
  title: z.string().min(2).optional(),
  contentMd: z.string().min(4).optional(),
  private: z.boolean().optional(),
  useAsModel: z.boolean().optional(),
  useAsStyle: z.boolean().optional(),
  optInSearch: z.boolean().optional(),
  originType: z.string().max(120).optional().nullable(),
  originId: z.string().max(120).optional().nullable(),
  archived: z.boolean().optional(),
});

async function loadReadable(id: string, workspaceId: string, userId: string) {
  return prisma.officeMemory.findFirst({
    where: {
      id,
      workspaceId,
      deletedAt: null,
      ...officeMemoryReadableWhere(userId),
    },
    select: {
      id: true,
      scope: true,
      caseId: true,
      ownerUserId: true,
      title: true,
      contentMd: true,
      private: true,
      useAsModel: true,
      useAsStyle: true,
      optInSearch: true,
      originType: true,
      originId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  const row = await loadReadable(id, workspaceId, user.id);
  if (!row) return NextResponse.json({ error: "Memória não encontrada" }, { status: 404 });
  return NextResponse.json({ memory: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  const existing = await loadReadable(id, workspaceId, user.id);
  if (!existing) return NextResponse.json({ error: "Memória não encontrada" }, { status: 404 });

  const body = PatchSchema.parse(await req.json());

  const data: Prisma.OfficeMemoryUpdateInput = {
    updatedBy: { connect: { id: user.id } },
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.contentMd !== undefined ? { contentMd: body.contentMd } : {}),
    ...(typeof body.private === "boolean" ? { private: body.private } : {}),
    ...(typeof body.useAsModel === "boolean" ? { useAsModel: body.useAsModel } : {}),
    ...(typeof body.useAsStyle === "boolean" ? { useAsStyle: body.useAsStyle } : {}),
    ...(typeof body.optInSearch === "boolean" ? { optInSearch: body.optInSearch } : {}),
    ...(body.originType !== undefined ? { originType: body.originType } : {}),
    ...(body.originId !== undefined ? { originId: body.originId } : {}),
    ...(typeof body.archived === "boolean" ? { archivedAt: body.archived ? new Date() : null } : {}),
  };

  await prisma.officeMemory.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  const url = new URL(req.url);
  if (url.searchParams.get("confirm") !== "1") {
    return NextResponse.json({ error: "Confirmação obrigatória. Reenvie com ?confirm=1" }, { status: 400 });
  }

  const existing = await loadReadable(id, workspaceId, user.id);
  if (!existing) return NextResponse.json({ error: "Memória não encontrada" }, { status: 404 });

  await prisma.officeMemory.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: { connect: { id: user.id } } },
  });
  return NextResponse.json({ ok: true });
}
