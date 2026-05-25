import { NextResponse } from "next/server";
import { getCrmApiContext, getCrmWorkspaceSummary, handleCrmRouteError } from "@/lib/justos/crm";

export async function GET() {
  try {
    const { workspaceId } = await getCrmApiContext();
    const summary = await getCrmWorkspaceSummary(workspaceId);
    return NextResponse.json({ summary });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
