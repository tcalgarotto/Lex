import { randomBytes } from "node:crypto";
import { InvitationStatus, MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const INVITE_TTL_DAYS = 7;

export function generateInvitationToken(): string {
  return randomBytes(24).toString("base64url");
}

export function defaultExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Cria um convite. Se já existir um PENDING para o mesmo email naquele workspace,
 * faz update (renova token e expiração) — evita "lixo" de convites duplicados.
 */
export async function createOrRefreshInvitation(params: {
  workspaceId: string;
  email: string;
  role: MembershipRole;
  invitedById: string;
}): Promise<{ token: string; id: string; expiresAt: Date; isNew: boolean }> {
  const email = params.email.trim().toLowerCase();
  const token = generateInvitationToken();
  const expiresAt = defaultExpiry();

  const existing = await prisma.invitation.findFirst({
    where: { workspaceId: params.workspaceId, email, status: InvitationStatus.PENDING },
  });

  if (existing) {
    const updated = await prisma.invitation.update({
      where: { id: existing.id },
      data: {
        token,
        role: params.role,
        expiresAt,
        invitedById: params.invitedById,
      },
    });
    return { token: updated.token, id: updated.id, expiresAt: updated.expiresAt, isNew: false };
  }

  const created = await prisma.invitation.create({
    data: {
      workspaceId: params.workspaceId,
      email,
      role: params.role,
      token,
      invitedById: params.invitedById,
      expiresAt,
    },
  });
  return { token: created.token, id: created.id, expiresAt: created.expiresAt, isNew: true };
}

/**
 * Aceita um convite: valida token, status, expiração e bate o email com o user logado.
 * Cria Membership se ainda não existir. Idempotente.
 */
export async function acceptInvitation(params: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ workspaceId: string; role: MembershipRole }> {
  const inv = await prisma.invitation.findUnique({ where: { token: params.token } });
  if (!inv) throw new Error("Convite inválido.");
  if (inv.status === InvitationStatus.REVOKED)
    throw new Error("Este convite foi revogado.");
  if (inv.status === InvitationStatus.EXPIRED || inv.expiresAt.getTime() < Date.now()) {
    if (inv.status !== InvitationStatus.EXPIRED) {
      await prisma.invitation.update({
        where: { id: inv.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }
    throw new Error("Este convite expirou. Solicite um novo.");
  }
  if (inv.email.toLowerCase() !== params.userEmail.toLowerCase()) {
    throw new Error(
      `Convite emitido para ${inv.email}. Faça login com esse e-mail para aceitar.`,
    );
  }

  const role = inv.role;
  const workspaceId = inv.workspaceId;

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        workspaceId_userId: { workspaceId, userId: params.userId },
      },
      create: {
        workspaceId,
        userId: params.userId,
        role,
      },
      update: { role },
    });
    if (inv.status === InvitationStatus.PENDING) {
      await tx.invitation.update({
        where: { id: inv.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedBy: params.userId,
        },
      });
    }
    await tx.activity.create({
      data: {
        workspaceId,
        kind: "team.member.added",
        title: `${params.userEmail} entrou no workspace como ${role}`,
        metaJson: { userId: params.userId, role, invitationId: inv.id },
      },
    });
  });

  return { workspaceId, role };
}

export async function revokeInvitation(params: {
  workspaceId: string;
  invitationId: string;
}): Promise<void> {
  await prisma.invitation.updateMany({
    where: {
      id: params.invitationId,
      workspaceId: params.workspaceId,
      status: InvitationStatus.PENDING,
    },
    data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
  });
}
