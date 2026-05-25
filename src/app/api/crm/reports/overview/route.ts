import { NextResponse } from "next/server";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { getCrmReportsOverview } from "@/lib/justos/crm/reports-service";

export async function GET() {
  try {
    const { workspaceId } = await getCrmApiContext();
    const report = await getCrmReportsOverview(workspaceId);
    return NextResponse.json(report);
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
