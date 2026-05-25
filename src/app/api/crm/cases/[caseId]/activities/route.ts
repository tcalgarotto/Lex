import { NextResponse } from "next/server";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { listCaseActivities } from "@/lib/justos/crm/timeline-service";

type Params = { params: Promise<{ caseId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { caseId } = await params;
    const activities = await listCaseActivities(workspaceId, caseId);
    return NextResponse.json({ activities });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
