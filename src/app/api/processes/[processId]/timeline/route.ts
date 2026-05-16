import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, ctx: { params: Promise<{ processId: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { processId } = await ctx.params;
  const url = new URL(req.url);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") ?? "50")));
  const legalProcess = await prisma.legalProcess.findFirst({
    where: { workspaceId, OR: [{ id: processId }, { processId }] },
    select: { id: true },
  });
  if (!legalProcess) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const movements = await prisma.legalProcessMovement.findMany({
    where: { workspaceId, legalProcessId: legalProcess.id },
    orderBy: [{ dataHora: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      codigo: true,
      nome: true,
      dataHora: true,
      category: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ movements });
}
