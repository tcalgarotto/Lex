import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { computeProcessHealth } from "@/lib/legal-processes/process-health";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ processId: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { processId } = await ctx.params;
  const legalProcess = await prisma.legalProcess.findFirst({
    where: { workspaceId, OR: [{ id: processId }, { processId }] },
    select: { id: true },
  });
  if (!legalProcess) return NextResponse.json({ error: "Processo DataJud não encontrado" }, { status: 404 });
  const health = await computeProcessHealth({ workspaceId, legalProcessId: legalProcess.id });
  return NextResponse.json(health);
}
