import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";


const CreateSchema = z.object({
  title: z.string().min(3),
  contentMd: z.string().min(10),
  tags: z.array(z.string().min(1)).optional(),
  scope: z.enum(["WORKSPACE", "USER"]).optional(),
  ownerUserId: z.string().min(3).optional(),
  optInRag: z.boolean().optional(),
  optInMemory: z.boolean().optional(),
  useAsModel: z.boolean().optional(),
  useAsStyle: z.boolean().optional(),
  sourceJson: z.unknown().optional(),
});

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const includeArchived = url.searchParams.get("archived") === "1";

  const items = await prisma.libraryFoundation.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { contentMd: { contains: q, mode: "insensitive" } },
              { tags: { has: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      tags: true,
      scope: true,
      ownerUserId: true,
      optInRag: true,
      optInMemory: true,
      useAsModel: true,
      useAsStyle: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ foundations: items });
}

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const body = CreateSchema.parse(await req.json());

  const created = await prisma.libraryFoundation.create({
    data: {
      workspaceId,
      title: body.title,
      contentMd: body.contentMd,
      tags: body.tags ?? [],
      scope: body.scope ?? "WORKSPACE",
      ownerUserId: body.scope === "USER" ? user.id : body.ownerUserId ?? null,
      optInRag: body.optInRag ?? false,
      optInMemory: body.optInMemory ?? false,
      useAsModel: body.useAsModel ?? false,
      useAsStyle: body.useAsStyle ?? false,
      ...(body.sourceJson ? { sourceJson: body.sourceJson as Prisma.InputJsonValue } : {}),
      createdById: user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

