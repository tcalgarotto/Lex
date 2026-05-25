import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCrmApiContext, getCrmConversation, handleCrmRouteError } from "@/lib/justos/crm";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const conv = await getCrmConversation({ workspaceId, conversationId: id });
    await prisma.crmContact.update({
      where: { id: conv.contactId },
      data: { optOutWhatsapp: true },
    });
    return NextResponse.json({ ok: true, optOutWhatsapp: true });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
