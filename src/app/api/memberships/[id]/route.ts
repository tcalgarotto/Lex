import { NextResponse } from "next/server";
import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const patchSchema = z.object({
  role: z.nativeEnum(MembershipRole),
});

/**
 * Regras de proteção:
 *  - Não permitir alterar/excluir o próprio Membership (auto-rebaixamento bloqueado).
 *  - Não permitir alterar/excluir um OWNER (transfer-ownership é fluxo separado).
 *  - ADMIN não pode promover ninguém para OWNER, nem alterar outro ADMIN.
 *  - Sempre garantir que reste pelo menos 1 OWNER no workspace.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId, role: actorRole, user } = await requirePermission(
    "membersChangeRole",
  );

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const newRole = parsed.data.role;

  const target = await prisma.membership.findFirst({
    where: { id, workspaceId },
  });
  if (!target) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }
  if (target.userId === user.id) {
    return NextResponse.json(
      { error: "Você não pode alterar a própria função." },
      { status: 400 },
    );
  }
  if (target.role === MembershipRole.OWNER) {
    return NextResponse.json(
      { error: "Não é possível alterar o OWNER." },
      { status: 400 },
    );
  }
  if (newRole === MembershipRole.OWNER) {
    return NextResponse.json(
      {
        error: "Promover para OWNER requer transferência de propriedade (fluxo separado).",
      },
      { status: 400 },
    );
  }
  if (
    actorRole === MembershipRole.ADMIN &&
    target.role === MembershipRole.ADMIN
  ) {
    return NextResponse.json(
      { error: "ADMIN não pode alterar outro ADMIN. Peça para o OWNER." },
      { status: 403 },
    );
  }

  const updated = await prisma.membership.update({
    where: { id },
    data: { role: newRole },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "team.role.changed",
      title: `Função alterada: ${target.userId} agora é ${newRole}`,
      metaJson: { membershipId: id, fromRole: target.role, toRole: newRole },
    },
  });

  return NextResponse.json({ id: updated.id, role: updated.role });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { workspaceId, role: actorRole, user } = await requirePermission(
    "membersRemove",
  );

  const target = await prisma.membership.findFirst({
    where: { id, workspaceId },
    include: { user: { select: { email: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }
  if (target.userId === user.id) {
    return NextResponse.json(
      { error: "Você não pode remover a si mesmo." },
      { status: 400 },
    );
  }
  if (target.role === MembershipRole.OWNER) {
    return NextResponse.json(
      { error: "Não é possível remover o OWNER." },
      { status: 400 },
    );
  }
  if (
    actorRole === MembershipRole.ADMIN &&
    target.role === MembershipRole.ADMIN
  ) {
    return NextResponse.json(
      { error: "ADMIN não pode remover outro ADMIN." },
      { status: 403 },
    );
  }

  await prisma.membership.delete({ where: { id } });
  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "team.member.removed",
      title: `Membro removido: ${target.user.email}`,
      metaJson: { userId: target.userId, role: target.role },
    },
  });

  return NextResponse.json({ ok: true });
}
