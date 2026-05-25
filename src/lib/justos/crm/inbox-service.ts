import { prisma } from "@/lib/prisma";
import { listCrmConversations, type InboxListFilters } from "./conversation-service";

export async function getCrmInboxOverview(
  workspaceId: string,
  filters?: InboxListFilters,
) {
  const conversations = await listCrmConversations({
    workspaceId,
    limit: 100,
    filters,
  });
  const unreadTotal = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const byStage = await prisma.crmContact.groupBy({
    by: ["pipelineStage"],
    where: { workspaceId, deletedAt: null },
    _count: { id: true },
  });

  return {
    conversations,
    unreadTotal,
    pipelineCounts: byStage.map((r) => ({
      stage: r.pipelineStage,
      count: r._count.id,
    })),
  };
}
