import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { revokeInvitation } from "@/lib/auth/invitations";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId } = await requirePermission("membersInvite");

  const inv = await prisma.invitation.findFirst({
    where: { id, workspaceId },
    select: { id: true, email: true, role: true },
  });
  if (!inv) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }

  await revokeInvitation({ workspaceId, invitationId: id });
  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "team.invite.revoked",
      title: `Convite revogado: ${inv.email}`,
      metaJson: { invitationId: inv.id, email: inv.email, role: inv.role },
    },
  });
  return NextResponse.json({ ok: true });
}
