import { NextResponse } from "next/server";
import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  scope: z.enum(["USER", "WORKSPACE"]).optional(),
  title: z.string().min(2).max(160),
  description: z.string().min(2).max(10_000).nullable().optional(),
  domain: z.string().min(2).max(80).nullable().optional(),
  schemaJson: z.unknown().refine((v) => v !== null, "schemaJson não pode ser null"),
});

export async function GET(req: Request) {
  const { user, workspaceId } = await requireRole([
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.LAWYER,
  ]);

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope"); // USER | WORKSPACE | null

  const where =
    scope === "USER"
      ? { workspaceId, scope: "USER" as const, ownerUserId: user.id }
      : scope === "WORKSPACE"
        ? { workspaceId, scope: "WORKSPACE" as const }
        : {
            workspaceId,
            OR: [
              { scope: "WORKSPACE" as const },
              { scope: "USER" as const, ownerUserId: user.id },
            ],
          };

  const templates = await prisma.interviewTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      scope: true,
      ownerUserId: true,
      title: true,
      description: true,
      domain: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const { user, workspaceId } = await requireRole([
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.LAWYER,
  ]);

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const scope = parsed.data.scope ?? "WORKSPACE";
  const ownerUserId = scope === "USER" ? user.id : null;

  const created = await prisma.interviewTemplate.create({
    data: {
      workspaceId,
      scope,
      ownerUserId,
      title: parsed.data.title,
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
      schemaJson: parsed.data.schemaJson as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}

