/**
 * Repository de notificações — multi-tenant + por usuário.
 *
 * Notificação com `userId=null` é broadcast no workspace (todos veem).
 * Marcar como lida só atualiza para o usuário em questão (broadcast
 * permanece UNREAD para os demais — read-state por user é tratado no consumo).
 */

import {
  NotificationKind,
  NotificationStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ListNotificationsArgs = {
  workspaceId: string;
  userId: string;
  status?: NotificationStatus[];
  kind?: NotificationKind[];
  take?: number;
};

export async function listNotifications(args: ListNotificationsArgs) {
  const where: Prisma.NotificationWhereInput = {
    workspaceId: args.workspaceId,
    OR: [{ userId: args.userId }, { userId: null }],
  };
  if (args.status?.length) where.status = { in: args.status };
  if (args.kind?.length) where.kind = { in: args.kind };
  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(200, args.take ?? 50)),
  });
}

export async function countUnread(args: {
  workspaceId: string;
  userId: string;
}): Promise<number> {
  return prisma.notification.count({
    where: {
      workspaceId: args.workspaceId,
      status: NotificationStatus.UNREAD,
      OR: [{ userId: args.userId }, { userId: null }],
    },
  });
}

export async function markAsRead(args: {
  workspaceId: string;
  userId: string;
  notificationId: string;
}) {
  return prisma.notification.updateMany({
    where: {
      id: args.notificationId,
      workspaceId: args.workspaceId,
      OR: [{ userId: args.userId }, { userId: null }],
      status: NotificationStatus.UNREAD,
    },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });
}

export async function markAllAsRead(args: {
  workspaceId: string;
  userId: string;
}) {
  return prisma.notification.updateMany({
    where: {
      workspaceId: args.workspaceId,
      OR: [{ userId: args.userId }, { userId: null }],
      status: NotificationStatus.UNREAD,
    },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });
}
