import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE } from "@/lib/constants";

export const runtime = "nodejs";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await requireAuthUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
  }

  const m = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: parsed.data.workspaceId, userId: user.id },
    },
  });
  if (!m) {
    return NextResponse.json(
      { error: "Você não pertence a este workspace." },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, parsed.data.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, workspaceId: parsed.data.workspaceId });
}

export async function GET() {
  const user = await requireAuthUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    workspaces: memberships.map((m) => ({
      id: m.workspaceId,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  });
}
