import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const take = Math.min(200, Math.max(1, Number(searchParams.get("take") ?? "80")));

  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, workspaceId },
    select: { id: true },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread não encontrada" }, { status: 404 });
  }

  const rows = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      role: true,
      content: true,
      citationsJson: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      annotations: m.citationsJson ? [{ type: "citations", citations: m.citationsJson }] : [],
    })),
  });
}

