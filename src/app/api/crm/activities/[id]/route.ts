import { NextResponse } from "next/server";
import { z } from "zod";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { deleteCrmActivity, patchCrmActivity } from "@/lib/justos/crm/timeline-service";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  doneAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const body = PatchSchema.parse(await req.json());
    const activity = await patchCrmActivity(workspaceId, id, {
      title: body.title,
      body: body.body,
      dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null,
      doneAt: body.doneAt === undefined ? undefined : body.doneAt ? new Date(body.doneAt) : null,
      assignedToUserId: body.assignedToUserId,
    });
    return NextResponse.json({ activity });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    await deleteCrmActivity(workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
