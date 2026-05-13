import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { syncProcessMovements } from "@/lib/legal-processes/sync-process-movements";

export async function POST(_req: Request, ctx: { params: Promise<{ processId: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { processId } = await ctx.params;
  const legalProcess = await prisma.legalProcess.findFirst({
    where: {
      workspaceId,
      OR: [{ id: processId }, { processId }],
    },
    select: { id: true },
  });
  if (!legalProcess) {
    return NextResponse.json({ error: "Processo DataJud não encontrado" }, { status: 404 });
  }
  try {
    const result = await syncProcessMovements({ workspaceId, legalProcessId: legalProcess.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao sincronizar" },
      { status: 400 },
    );
  }
}
