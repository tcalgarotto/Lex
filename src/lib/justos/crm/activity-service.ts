import { prisma } from "@/lib/prisma";
import { assertCaseInWorkspace } from "./permissions";

export type CaseCrmSummary = {
  contactCount: number;
  conversationCount: number;
  recentMessages: Array<{
    id: string;
    direction: string;
    sentAt: string;
    bodyPreview: string;
    contactName: string;
  }>;
  contacts: Array<{
    id: string;
    displayName: string;
    phoneE164: string | null;
    pipelineStage: string;
  }>;
};

export async function getCaseCrmSummary(
  workspaceId: string,
  caseId: string,
): Promise<CaseCrmSummary> {
  await assertCaseInWorkspace(workspaceId, caseId);

  const contacts = await prisma.crmContact.findMany({
    where: { workspaceId, caseId, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      phoneE164: true,
      pipelineStage: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const conversations = await prisma.crmConversation.findMany({
    where: { workspaceId, caseId },
    select: { id: true },
  });

  const messages = await prisma.crmMessage.findMany({
    where: {
      workspaceId,
      conversation: { caseId },
    },
    orderBy: { sentAt: "desc" },
    take: 10,
    include: {
      conversation: {
        include: { contact: { select: { displayName: true } } },
      },
    },
  });

  return {
    contactCount: contacts.length,
    conversationCount: conversations.length,
    contacts,
    recentMessages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      sentAt: m.sentAt.toISOString(),
      bodyPreview: m.body.slice(0, 120),
      contactName: m.conversation.contact.displayName,
    })),
  };
}

export async function getCrmWorkspaceSummary(workspaceId: string): Promise<{
  contactCount: number;
  conversationCount: number;
  unreadTotal: number;
  byStage: Array<{ stage: string; count: number }>;
}> {
  const [contactCount, conversationCount, unread, byStage] = await Promise.all([
    prisma.crmContact.count({ where: { workspaceId, deletedAt: null } }),
    prisma.crmConversation.count({ where: { workspaceId } }),
    prisma.crmConversation.aggregate({
      where: { workspaceId },
      _sum: { unreadCount: true },
    }),
    prisma.crmContact.groupBy({
      by: ["pipelineStage"],
      where: { workspaceId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  return {
    contactCount,
    conversationCount,
    unreadTotal: unread._sum.unreadCount ?? 0,
    byStage: byStage.map((r) => ({ stage: r.pipelineStage, count: r._count._all })),
  };
}
