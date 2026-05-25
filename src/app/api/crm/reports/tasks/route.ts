import { NextResponse } from "next/server";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { getCrmReportsTasks } from "@/lib/justos/crm/reports-service";

export async function GET() {
  try {
    const { workspaceId } = await getCrmApiContext();
    return NextResponse.json(await getCrmReportsTasks(workspaceId));
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
