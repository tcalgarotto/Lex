import { prisma } from "@/lib/prisma";
import { readJustosCommandUrl } from "../env";

export async function getCrmReportsOverview(workspaceId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [contactsByStage, messagesWeek, unreadConversations, waitingClient] =
    await Promise.all([
      prisma.crmContact.groupBy({
        by: ["pipelineStage"],
        where: { workspaceId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.crmMessage.count({
        where: { workspaceId, sentAt: { gte: weekAgo } },
      }),
      prisma.crmConversation.count({
        where: { workspaceId, unreadCount: { gt: 0 } },
      }),
      prisma.crmContact.count({
        where: {
          workspaceId,
          deletedAt: null,
          pipelineStage: "WAITING_CLIENT",
        },
      }),
    ]);

  let overdueTasks = 0;
  try {
    overdueTasks = await prisma.crmActivity.count({
      where: {
        workspaceId,
        type: { in: ["TASK", "FOLLOW_UP"] },
        doneAt: null,
        dueAt: { lt: new Date() },
      },
    });
  } catch {
    overdueTasks = 0;
  }

  const [newLeads, waitingOffice] = await Promise.all([
    prisma.crmContact.count({
      where: {
        workspaceId,
        deletedAt: null,
        pipelineStage: "NEW",
        createdAt: { gte: weekAgo },
      },
    }),
    prisma.crmContact.count({
      where: { workspaceId, deletedAt: null, pipelineStage: "ACTIVE" },
    }),
  ]);

  return {
    contactsByStage: contactsByStage.map((r) => ({
      stage: r.pipelineStage,
      count: r._count.id,
    })),
    messagesLast7Days: messagesWeek,
    unreadConversations,
    contactsWaitingClient: waitingClient,
    newLeadsWeek: newLeads,
    overdueTasks,
    contactsWaitingOffice: waitingOffice,
  };
}

export async function getCrmReportsFunnel(workspaceId: string) {
  const rows = await prisma.crmContact.groupBy({
    by: ["pipelineStage"],
    where: { workspaceId, deletedAt: null },
    _count: { id: true },
  });
  return { funnel: rows.map((r) => ({ stage: r.pipelineStage, count: r._count.id })) };
}

export async function getCrmReportsMessages(workspaceId: string, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const messages = await prisma.crmMessage.findMany({
    where: { workspaceId, sentAt: { gte: since } },
    select: { sentAt: true, direction: true },
    orderBy: { sentAt: "asc" },
  });
  const byDay: Record<string, { inbound: number; outbound: number }> = {};
  for (const m of messages) {
    const day = m.sentAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { inbound: 0, outbound: 0 };
    if (m.direction === "INBOUND") byDay[day].inbound++;
    else byDay[day].outbound++;
  }
  return { byDay: Object.entries(byDay).map(([date, counts]) => ({ date, ...counts })) };
}

export async function getCrmReportsTasks(workspaceId: string) {
  const now = new Date();
  const [open, overdue, doneWeek] = await Promise.all([
    prisma.crmActivity.count({
      where: { workspaceId, type: { in: ["TASK", "FOLLOW_UP"] }, doneAt: null },
    }),
    prisma.crmActivity.count({
      where: {
        workspaceId,
        type: { in: ["TASK", "FOLLOW_UP"] },
        doneAt: null,
        dueAt: { lt: now },
      },
    }),
    prisma.crmActivity.count({
      where: {
        workspaceId,
        type: { in: ["TASK", "FOLLOW_UP"] },
        doneAt: { gte: new Date(now.getTime() - 7 * 86400000) },
      },
    }),
  ]);
  return { open, overdue, completedLast7Days: doneWeek };
}

export async function getCrmReportsWaHealth(workspaceId: string) {
  const session = await prisma.justosWhatsappSession.findUnique({
    where: { workspaceId },
  });
  const commandUrl = readJustosCommandUrl() ?? "http://127.0.0.1:3301";
  let commandOnline = false;
  try {
    const r = await fetch(`${commandUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    commandOnline = r.ok;
  } catch {
    commandOnline = false;
  }
  return {
    sessionStatus: session?.status ?? "disconnected",
    sessionKey: session?.sessionKey ?? null,
    commandOnline,
    sendEnabled: process.env["JUSTOS_CRM_ENABLE_WA_SEND"] === "true",
    openClawMode: process.env["JUSTOS_OPENCLAW_MODE"] ?? "dev-single",
  };
}
