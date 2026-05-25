import { NextResponse } from "next/server";
import { getCaseCrmSummary, getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";

type Params = { params: Promise<{ caseId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { caseId } = await params;
    const summary = await getCaseCrmSummary(workspaceId, caseId);
    return NextResponse.json({ summary });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
