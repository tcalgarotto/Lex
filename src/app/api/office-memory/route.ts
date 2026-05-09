import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficeMemoryScope } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officeMemoryReadableWhere } from "@/lib/office-memory/visibility";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().min(2),
  contentMd: z.string().min(4),
  scope: z.nativeEnum(OfficeMemoryScope),
  caseId: z.string().min(3).optional().nullable(),
  private: z.boolean().optional(),
  useAsModel: z.boolean().optional(),
  useAsStyle: z.boolean().optional(),
  optInRag: z.boolean().optional(),
  originType: z.string().max(120).optional().nullable(),
  originId: z.string().max(120).optional().nullable(),
});

export async function GET(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "1";

  const items = await prisma.officeMemory.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...officeMemoryReadableWhere(user.id),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      scope: true,
      caseId: true,
      ownerUserId: true,
      title: true,
      private: true,
      useAsModel: true,
      useAsStyle: true,
      optInRag: true,
      originType: true,
      originId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      case: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({ memories: items });
}

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const body = CreateSchema.parse(await req.json());

  if (body.scope === "CASE") {
    if (!body.caseId) {
      return NextResponse.json({ error: "caseId obrigatório para escopo CASE" }, { status: 400 });
    }
    const c = await prisma.case.findFirst({
      where: { id: body.caseId, workspaceId },
      select: { id: true },
    });
    if (!c) return NextResponse.json({ error: "Caso não encontrado neste workspace" }, { status: 404 });
  } else if (body.caseId) {
    return NextResponse.json({ error: "caseId só é permitido com escopo CASE" }, { status: 400 });
  }
  if (body.scope === "USER" && body.caseId) {
    return NextResponse.json({ error: "Escopo USER não admite caseId" }, { status: 400 });
  }

  let ownerUserId: string | null = null;
  if (body.scope === "USER") {
    ownerUserId = user.id;
  } else if (body.scope === "WORKSPACE" || body.scope === "CASE") {
    ownerUserId = null;
  }

  const created = await prisma.officeMemory.create({
    data: {
      workspaceId,
      scope: body.scope,
      caseId: body.scope === "CASE" ? body.caseId : null,
      ownerUserId,
      title: body.title,
      contentMd: body.contentMd,
      private: body.private ?? false,
      useAsModel: body.useAsModel ?? false,
      useAsStyle: body.useAsStyle ?? false,
      optInRag: body.optInRag ?? false,
      originType: body.originType ?? null,
      originId: body.originId ?? null,
      createdById: user.id,
      updatedById: user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
