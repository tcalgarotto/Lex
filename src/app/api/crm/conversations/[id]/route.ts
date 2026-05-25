import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCrmApiContext,
  getCrmConversation,
  handleCrmRouteError,
  patchCrmConversation,
} from "@/lib/justos/crm";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  caseId: z.string().cuid().nullable().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const conversation = await getCrmConversation({ workspaceId, conversationId: id });
    return NextResponse.json({ conversation });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const body = PatchSchema.parse(await req.json());
    const conversation = await patchCrmConversation({
      workspaceId,
      conversationId: id,
      caseId: body.caseId,
    });
    return NextResponse.json({ conversation });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}
