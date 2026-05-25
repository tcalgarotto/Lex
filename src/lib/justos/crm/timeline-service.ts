import type { CrmActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CrmNotFoundError } from "./permissions";

export type CreateCrmActivityInput = {
  type: CrmActivityType;
  title: string;
  body?: string | null;
  caseId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  dueAt?: Date | null;
  assignedToUserId?: string | null;
  createdByUserId?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

export async function recordCrmActivity(
  workspaceId: string,
  contactId: string,
  input: CreateCrmActivityInput,
) {
  const contact = await prisma.crmContact.findFirst({
    where: { id: contactId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!contact) throw new CrmNotFoundError();

  return prisma.crmActivity.create({
    data: {
      workspaceId,
      contactId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      caseId: input.caseId ?? null,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      dueAt: input.dueAt ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      metadataJson: input.metadataJson ?? undefined,
    },
  });
}

export async function listContactActivities(workspaceId: string, contactId: string, limit = 50) {
  return prisma.crmActivity.findMany({
    where: { workspaceId, contactId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listCaseActivities(workspaceId: string, caseId: string, limit = 50) {
  return prisma.crmActivity.findMany({
    where: { workspaceId, caseId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listCrmTasks(workspaceId: string, opts?: { overdueOnly?: boolean; mine?: string }) {
  const now = new Date();
  return prisma.crmActivity.findMany({
    where: {
      workspaceId,
      type: { in: ["TASK", "FOLLOW_UP"] },
      doneAt: null,
      ...(opts?.overdueOnly ? { dueAt: { lt: now } } : {}),
      ...(opts?.mine ? { assignedToUserId: opts.mine } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { contact: { select: { id: true, displayName: true, phoneE164: true } } },
  });
}

export async function createCrmTask(
  workspaceId: string,
  contactId: string,
  input: {
    title: string;
    body?: string;
    dueAt?: Date;
    type?: "TASK" | "FOLLOW_UP";
    caseId?: string;
    assignedToUserId?: string;
    createdByUserId?: string;
  },
) {
  return recordCrmActivity(workspaceId, contactId, {
    type: input.type ?? "TASK",
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    caseId: input.caseId,
    assignedToUserId: input.assignedToUserId,
    createdByUserId: input.createdByUserId,
  });
}

export async function patchCrmActivity(
  workspaceId: string,
  activityId: string,
  patch: {
    title?: string;
    body?: string | null;
    dueAt?: Date | null;
    doneAt?: Date | null;
    assignedToUserId?: string | null;
  },
) {
  const row = await prisma.crmActivity.findFirst({
    where: { id: activityId, workspaceId },
  });
  if (!row) throw new CrmNotFoundError();
  return prisma.crmActivity.update({
    where: { id: activityId },
    data: patch,
  });
}

export async function deleteCrmActivity(workspaceId: string, activityId: string) {
  const row = await prisma.crmActivity.findFirst({
    where: { id: activityId, workspaceId },
  });
  if (!row) throw new CrmNotFoundError();
  await prisma.crmActivity.delete({ where: { id: activityId } });
}
