import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId } = await getWorkspaceContext();
  const body = (await req.json()) as { contentJson: unknown };

  const piece = await prisma.legalPiece.findFirst({
    where: { id, workspaceId },
  });
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada" }, { status: 404 });
  }

  await prisma.legalPiece.update({
    where: { id, workspaceId },
    data: { contentJson: body.contentJson as object },
  });

  try {
    await inngest.send({
      name: "lex/style.recompute",
      data: { workspaceId, userId: null },
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
