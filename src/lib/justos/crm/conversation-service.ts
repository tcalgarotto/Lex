import type {
  CrmChannel,
  CrmConversation,
  CrmMessage,
  CrmPipelineStage,
  Prisma,
} from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { CrmNotFoundError } from "./permissions";
import { getCrmContact } from "./contact-service";
import { recordCrmActivity } from "./timeline-service";
import type { AppendCrmMessageInput } from "./types";

export type InboxListFilters = {
  unreadOnly?: boolean;
  stage?: CrmPipelineStage;
  assignedToUserId?: string;
  caseId?: string;
  q?: string;
};

export function hashMessageBodyForLog(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

export async function getOrCreateConversation(args: {
  workspaceId: string;
  contactId: string;
  channel?: CrmChannel;
  caseId?: string | null;
}): Promise<CrmConversation> {
  await getCrmContact({ workspaceId: args.workspaceId, contactId: args.contactId });
  const channel = args.channel ?? "WHATSAPP";

  const existing = await prisma.crmConversation.findFirst({
    where: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      channel,
      caseId: args.caseId ?? null,
    },
  });
  if (existing) return existing;

  return prisma.crmConversation.create({
    data: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      channel,
      caseId: args.caseId ?? null,
    },
  });
}

export async function listCrmConversations(args: {
  workspaceId: string;
  limit?: number;
  filters?: InboxListFilters;
}) {
  const f = args.filters;
  const where: Prisma.CrmConversationWhereInput = {
    workspaceId: args.workspaceId,
    ...(f?.unreadOnly ? { unreadCount: { gt: 0 } } : {}),
    ...(f?.caseId ? { caseId: f.caseId } : {}),
    ...(f?.assignedToUserId ? { assignedToUserId: f.assignedToUserId } : {}),
    ...(f?.stage
      ? { contact: { pipelineStage: f.stage, deletedAt: null } }
      : { contact: { deletedAt: null } }),
    ...(f?.q
      ? {
          OR: [
            { contact: { displayName: { contains: f.q, mode: "insensitive" } } },
            { contact: { phoneE164: { contains: f.q.replace(/\D/g, "") } } },
            { messages: { some: { body: { contains: f.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  return prisma.crmConversation.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: args.limit ?? 50,
    include: {
      contact: {
        select: {
          id: true,
          displayName: true,
          phoneE164: true,
          pipelineStage: true,
          optOutWhatsapp: true,
          caseId: true,
          assignedToUserId: true,
        },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1, select: { body: true, direction: true, sentAt: true } },
    },
  });
}

export async function getCrmConversationMessages(args: {
  workspaceId: string;
  conversationId: string;
  limit?: number;
}): Promise<CrmMessage[]> {
  const conv = await prisma.crmConversation.findFirst({
    where: { id: args.conversationId, workspaceId: args.workspaceId },
  });
  if (!conv) throw new CrmNotFoundError();

  return prisma.crmMessage.findMany({
    where: { workspaceId: args.workspaceId, conversationId: args.conversationId },
    orderBy: { sentAt: "desc" },
    take: args.limit ?? 100,
  });
}

export async function appendCrmMessage(args: {
  workspaceId: string;
  conversationId: string;
  input: AppendCrmMessageInput;
}): Promise<CrmMessage> {
  const conv = await prisma.crmConversation.findFirst({
    where: { id: args.conversationId, workspaceId: args.workspaceId },
    include: { contact: true },
  });
  if (!conv) throw new CrmNotFoundError();

  if (conv.contact.optOutWhatsapp && args.input.direction === "OUTBOUND") {
    throw new Error("Contato com opt-out de WhatsApp.");
  }

  const sentAt = args.input.sentAt ?? new Date();
  const msg = await prisma.crmMessage.create({
    data: {
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      direction: args.input.direction,
      body: args.input.body,
      sentAt,
      traceId: args.input.traceId,
      deliveryStatus: args.input.deliveryStatus ?? "stored",
      metaJson: {
        ...(args.input.metaJson ?? {}),
        bodyHash: hashMessageBodyForLog(args.input.body),
      },
    },
  });

  await prisma.crmConversation.update({
    where: { id: args.conversationId },
    data: {
      lastMessageAt: sentAt,
      ...(args.input.direction === "INBOUND" ? { unreadCount: { increment: 1 } } : {}),
    },
  });

  void recordCrmActivity(args.workspaceId, conv.contactId, {
    type: args.input.direction === "INBOUND" ? "WHATSAPP_INBOUND" : "WHATSAPP_OUTBOUND",
    title: args.input.direction === "INBOUND" ? "Mensagem recebida" : "Mensagem enviada",
    body: args.input.body.slice(0, 500),
    caseId: conv.caseId,
    conversationId: args.conversationId,
    messageId: msg.id,
    metadataJson: { bodyHash: hashMessageBodyForLog(args.input.body), deliveryStatus: args.input.deliveryStatus },
  }).catch(() => {});

  return msg;
}

export async function getCrmConversation(args: {
  workspaceId: string;
  conversationId: string;
}) {
  const conv = await prisma.crmConversation.findFirst({
    where: { id: args.conversationId, workspaceId: args.workspaceId },
    include: {
      contact: true,
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });
  if (!conv) throw new CrmNotFoundError();
  return conv;
}

export async function markConversationRead(args: {
  workspaceId: string;
  conversationId: string;
}): Promise<void> {
  const conv = await prisma.crmConversation.findFirst({
    where: { id: args.conversationId, workspaceId: args.workspaceId },
  });
  if (!conv) throw new CrmNotFoundError();
  await prisma.crmConversation.update({
    where: { id: args.conversationId },
    data: { unreadCount: 0 },
  });
}

export async function patchCrmConversation(args: {
  workspaceId: string;
  conversationId: string;
  caseId?: string | null;
}): Promise<CrmConversation> {
  const conv = await prisma.crmConversation.findFirst({
    where: { id: args.conversationId, workspaceId: args.workspaceId },
  });
  if (!conv) throw new CrmNotFoundError();
  const updated = await prisma.crmConversation.update({
    where: { id: args.conversationId },
    data: { caseId: args.caseId ?? null },
  });

  void recordCrmActivity(args.workspaceId, conv.contactId, {
    type: "SYSTEM",
    title: args.caseId ? "Conversa vinculada ao caso" : "Vínculo com caso removido",
    caseId: args.caseId ?? null,
    conversationId: args.conversationId,
    metadataJson: { caseId: args.caseId },
  }).catch(() => {});

  return updated;
}
