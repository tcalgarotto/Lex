import { NextResponse } from "next/server";
import { getCrmApiContext, handleCrmRouteError, markConversationRead } from "@/lib/justos/crm";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    await markConversationRead({ workspaceId, conversationId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
