import { NextResponse } from "next/server";
import { z } from "zod";
import { changeCrmStage, getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { ChangeStageSchema } from "@/lib/justos/crm/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const body = ChangeStageSchema.parse(await req.json());
    const contact = await changeCrmStage({
      workspaceId,
      contactId: id,
      stage: body.pipelineStage,
    });
    return NextResponse.json({ contact });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido", detail: e.flatten() }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}
