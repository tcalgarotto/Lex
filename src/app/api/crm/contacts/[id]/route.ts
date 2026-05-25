import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCrmApiContext,
  getCrmContact,
  handleCrmRouteError,
  softDeleteCrmContact,
  updateCrmContact,
} from "@/lib/justos/crm";
import { UpdateCrmContactSchema } from "@/lib/justos/crm/validators";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const contact = await getCrmContact({ workspaceId, contactId: id });
    return NextResponse.json({ contact });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    let body: z.infer<typeof UpdateCrmContactSchema>;
    try {
      body = UpdateCrmContactSchema.parse(await req.json());
    } catch (e) {
      return NextResponse.json(
        { error: "Payload inválido", detail: e instanceof z.ZodError ? e.flatten() : String(e) },
        { status: 400 },
      );
    }
    const contact = await updateCrmContact({ workspaceId, contactId: id, data: body });
    return NextResponse.json({ contact });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    await softDeleteCrmContact({ workspaceId, contactId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
