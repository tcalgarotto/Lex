import { NextResponse } from "next/server";
import { getCrmApiContext, handleCrmRouteError, listCrmConversations } from "@/lib/justos/crm";

export async function GET() {
  try {
    const { workspaceId } = await getCrmApiContext();
    const conversations = await listCrmConversations({ workspaceId });
    return NextResponse.json({ conversations });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
