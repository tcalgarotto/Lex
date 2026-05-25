import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  DASHBOARD_KANBAN_COLUMN_IDS,
  type DashboardKanbanColumnId,
} from "@/lib/dashboard/dashboard-kanban";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  columnId: z.enum(DASHBOARD_KANBAN_COLUMN_IDS as unknown as [string, ...string[]]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId } = await context.params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "columnId inválido" }, { status: 400 });
  }

  const row = await prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { metadataJson: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta =
    row.metadataJson && typeof row.metadataJson === "object"
      ? { ...(row.metadataJson as Record<string, unknown>) }
      : {};

  meta["dashboardKanbanColumn"] = body.columnId as DashboardKanbanColumnId;
  meta["dashboardKanbanUpdatedAt"] = new Date().toISOString();

  await prisma.case.update({
    where: { id: caseId },
    data: { metadataJson: meta as object },
  });

  return NextResponse.json({ ok: true, columnId: body.columnId });
}
