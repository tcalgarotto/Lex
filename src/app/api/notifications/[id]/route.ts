/**
 * PATCH /api/notifications/[id] — marca como lida.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { markAsRead } from "@/lib/notifications/repository";


export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  const r = await markAsRead({ workspaceId, userId: user.id, notificationId: id });
  if (!r.count) {
    return NextResponse.json(
      { error: "Notificação não encontrada ou já lida." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
