import { NextResponse } from "next/server";
import { z } from "zod";
import { CrmActivityType } from "@prisma/client";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { createCrmTask, listContactActivities, recordCrmActivity } from "@/lib/justos/crm/timeline-service";

type Params = { params: Promise<{ id: string }> };

const PostSchema = z.object({
  type: z.nativeEnum(CrmActivityType).default("NOTE"),
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
  caseId: z.string().cuid().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const activities = await listContactActivities(workspaceId, id);
    return NextResponse.json({ activities });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getCrmApiContext();
    const { id } = await params;
    const body = PostSchema.parse(await req.json());
    const activity =
      body.type === "TASK" || body.type === "FOLLOW_UP"
        ? await createCrmTask(ctx.workspaceId, id, {
            title: body.title,
            body: body.body,
            dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
            type: body.type,
            caseId: body.caseId,
            createdByUserId: ctx.userId,
          })
        : await recordCrmActivity(ctx.workspaceId, id, {
            type: body.type,
            title: body.title,
            body: body.body,
            dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
            caseId: body.caseId,
            createdByUserId: ctx.userId,
          });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}
