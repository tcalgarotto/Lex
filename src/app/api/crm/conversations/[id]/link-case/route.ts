import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCrmApiContext,
  handleCrmRouteError,
  patchCrmConversation,
} from "@/lib/justos/crm";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  caseId: z.string().cuid().nullable(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const body = BodySchema.parse(await req.json());
    const conversation = await patchCrmConversation({
      workspaceId,
      conversationId: id,
      caseId: body.caseId,
    });
    return NextResponse.json({ ok: true, conversation });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}
