import { NextResponse } from "next/server";
import type { CrmPipelineStage } from "@prisma/client";
import { getCrmApiContext, getCrmInboxOverview, handleCrmRouteError } from "@/lib/justos/crm";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const url = new URL(req.url);
    const stageParam = url.searchParams.get("stage");
    const overview = await getCrmInboxOverview(workspaceId, {
      unreadOnly: url.searchParams.get("unread") === "1",
      q: url.searchParams.get("q") ?? undefined,
      caseId: url.searchParams.get("caseId") ?? undefined,
      assignedToUserId: url.searchParams.get("assignedTo") ?? undefined,
      stage: stageParam ? (stageParam as CrmPipelineStage) : undefined,
    });
    return NextResponse.json(overview);
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
