import { prisma } from "@/lib/prisma";

export async function exportCrmWorkspaceData(workspaceId: string) {
  const [contacts, conversations, messages, sessions] = await Promise.all([
    prisma.crmContact.findMany({ where: { workspaceId, deletedAt: null } }),
    prisma.crmConversation.findMany({ where: { workspaceId } }),
    prisma.crmMessage.findMany({
      where: { workspaceId },
      orderBy: { sentAt: "asc" },
      take: 50_000,
    }),
    prisma.justosWhatsappSession.findMany({ where: { workspaceId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    workspaceId,
    contacts: contacts.map((c) => ({
      ...c,
      metadataJson: c.metadataJson,
    })),
    conversations,
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      direction: m.direction,
      sentAt: m.sentAt,
      traceId: m.traceId,
      deliveryStatus: m.deliveryStatus,
      bodyLength: m.body.length,
      bodyPreview: m.body.slice(0, 120),
      metaJson: m.metaJson,
    })),
    whatsappSessions: sessions.map((s) => ({
      sessionKey: s.sessionKey,
      status: s.status,
      phoneE164: s.phoneE164,
      connectedAt: s.connectedAt,
      lastHealthAt: s.lastHealthAt,
    })),
  };
}
