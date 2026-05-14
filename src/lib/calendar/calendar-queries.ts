import type { Prisma } from "@prisma/client";
import { CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDateKeyInTimeZone, CALENDAR_DISPLAY_TIMEZONE } from "@/lib/calendar/calendar-labels";

export const calendarEventListInclude = {
  case: { select: { id: true, title: true } },
  legalProcess: { select: { id: true, cnjFormatted: true } },
  process: { select: { id: true, number: true, title: true } },
  document: { select: { id: true, originalName: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CalendarEventInclude;

export type CalendarEventWithRelations = Prisma.CalendarEventGetPayload<{
  include: typeof calendarEventListInclude;
}>;

export type ListCalendarEventsFilters = {
  workspaceId: string;
  from?: Date;
  to?: Date;
  caseId?: string | null;
  legalProcessId?: string | null;
  processId?: string | null;
  documentId?: string | null;
  assignedToUserId?: string | null;
  eventType?: string | null;
  status?: string | null;
  /** When set, exclude these statuses (e.g. hide DONE when include_done=false). */
  excludeStatuses?: CalendarEventStatus[];
};

export async function listCalendarEvents(filters: ListCalendarEventsFilters): Promise<CalendarEventWithRelations[]> {
  const where: Prisma.CalendarEventWhereInput = {
    workspaceId: filters.workspaceId,
  };
  if (filters.from || filters.to) {
    where.startsAt = {};
    if (filters.from) where.startsAt.gte = filters.from;
    if (filters.to) where.startsAt.lte = filters.to;
  }
  if (filters.caseId) where.caseId = filters.caseId;
  if (filters.legalProcessId) where.legalProcessId = filters.legalProcessId;
  if (filters.processId) where.processId = filters.processId;
  if (filters.documentId) where.documentId = filters.documentId;
  if (filters.assignedToUserId) where.assignedToUserId = filters.assignedToUserId;
  if (filters.eventType && (Object.values(CalendarEventType) as string[]).includes(filters.eventType)) {
    where.eventType = filters.eventType as CalendarEventType;
  }
  if (filters.status && (Object.values(CalendarEventStatus) as string[]).includes(filters.status)) {
    where.status = filters.status as CalendarEventStatus;
  } else if (filters.excludeStatuses && filters.excludeStatuses.length > 0) {
    where.status = { notIn: filters.excludeStatuses };
  }

  return prisma.calendarEvent.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: calendarEventListInclude,
  });
}

export type CalendarDashboardBuckets = {
  overdue: CalendarEventWithRelations[];
  today: CalendarEventWithRelations[];
  upcoming7d: CalendarEventWithRelations[];
};

export async function getCalendarDashboardBuckets(
  workspaceId: string,
  now: Date = new Date(),
): Promise<CalendarDashboardBuckets> {
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const todayKey = calendarDateKeyInTimeZone(now, tz);

  const base = await prisma.calendarEvent.findMany({
    where: {
      workspaceId,
      status: "PENDING",
    },
    orderBy: { startsAt: "asc" },
    include: calendarEventListInclude,
  });

  const overdue: CalendarEventWithRelations[] = [];
  const today: CalendarEventWithRelations[] = [];
  const upcoming7d: CalendarEventWithRelations[] = [];

  const msDay = 24 * 60 * 60 * 1000;
  const end7 = new Date(now.getTime() + 7 * msDay);

  for (const e of base) {
    const k = calendarDateKeyInTimeZone(e.startsAt, tz);
    if (k < todayKey) {
      overdue.push(e);
    } else if (k === todayKey) {
      today.push(e);
    } else if (e.startsAt <= end7) {
      upcoming7d.push(e);
    }
  }

  return { overdue, today, upcoming7d };
}

export async function listCalendarEventsForCase(
  workspaceId: string,
  caseId: string,
  from?: Date,
): Promise<CalendarEventWithRelations[]> {
  const f = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return prisma.calendarEvent.findMany({
    where: { workspaceId, caseId, startsAt: { gte: f } },
    orderBy: { startsAt: "asc" },
    take: 40,
    include: calendarEventListInclude,
  });
}

export async function listCalendarEventsForProcess(
  workspaceId: string,
  processId: string,
  legalProcessId: string | null,
): Promise<CalendarEventWithRelations[]> {
  const or: Prisma.CalendarEventWhereInput[] = [{ processId }];
  if (legalProcessId) or.push({ legalProcessId });
  return prisma.calendarEvent.findMany({
    where: { workspaceId, OR: or },
    orderBy: { startsAt: "asc" },
    take: 40,
    include: calendarEventListInclude,
  });
}
