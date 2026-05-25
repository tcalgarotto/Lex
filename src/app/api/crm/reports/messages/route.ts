import { NextResponse } from "next/server";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { getCrmReportsMessages } from "@/lib/justos/crm/reports-service";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const days = Number(new URL(req.url).searchParams.get("days") ?? "14");
    return NextResponse.json(await getCrmReportsMessages(workspaceId, days));
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
