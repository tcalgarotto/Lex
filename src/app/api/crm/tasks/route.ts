import { NextResponse } from "next/server";
import { z } from "zod";
import { getCrmApiContext, handleCrmRouteError } from "@/lib/justos/crm";
import { createCrmTask, listCrmTasks } from "@/lib/justos/crm/timeline-service";

export async function GET(req: Request) {
  try {
    const ctx = await getCrmApiContext();
    const url = new URL(req.url);
    const overdueOnly = url.searchParams.get("overdue") === "1";
    const mine = url.searchParams.get("mine") === "1";
    const tasks = await listCrmTasks(ctx.workspaceId, {
      overdueOnly,
      mine: mine ? ctx.userId : undefined,
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

const PostSchema = z.object({
  contactId: z.string().cuid(),
  title: z.string().min(1),
  body: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  caseId: z.string().cuid().optional(),
  type: z.enum(["TASK", "FOLLOW_UP"]).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await getCrmApiContext();
    const body = PostSchema.parse(await req.json());
    const task = await createCrmTask(ctx.workspaceId, body.contactId, {
      title: body.title,
      body: body.body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      caseId: body.caseId,
      type: body.type,
      assignedToUserId: ctx.userId,
      createdByUserId: ctx.userId,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}
