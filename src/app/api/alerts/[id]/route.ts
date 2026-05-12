/**
 * PATCH /api/alerts/[id] — ack / dismiss / resolve.
 *
 * Body: { action: "ack" | "dismiss" | "resolve" }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { ackAlert, dismissAlert, resolveAlert } from "@/lib/alerts/repository";


const PatchBody = z.object({
  action: z.enum(["ack", "dismiss", "resolve"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  let result: { count: number };
  if (body.action === "ack") {
    result = await ackAlert({ workspaceId, alertId: id, userId: user.id });
  } else if (body.action === "dismiss") {
    result = await dismissAlert({ workspaceId, alertId: id });
  } else {
    result = await resolveAlert({ workspaceId, alertId: id });
  }
  if (!result.count) {
    return NextResponse.json(
      { error: "Alerta não encontrado ou ação não aplicável." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
