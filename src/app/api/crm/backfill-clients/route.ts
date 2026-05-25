import { NextResponse } from "next/server";
import { backfillCrmContactsFromClients, getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";

export async function POST() {
  try {
    const { workspaceId } = await getCrmApiContext();
    const report = await backfillCrmContactsFromClients(workspaceId);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
