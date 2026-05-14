import { NextResponse } from "next/server";
import { CalendarEventSource, CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { endOfMonth, startOfMonth } from "date-fns";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { calendarEventListInclude, listCalendarEvents } from "@/lib/calendar/calendar-queries";
import { CalendarValidationError, validateCalendarEventLinks } from "@/lib/calendar/calendar-validation";
import {
  calendarRowToScheduleDto,
  scheduleDateTimeEndOrDefault,
  scheduleDateTimeToUtcDate,
  scheduleTypeToPrisma,
  SCHEDULE_EVENT_TYPES,
} from "@/lib/calendar/schedule-shapes";
import { scheduleEventPostSchema, type ScheduleEventPostBody } from "@/lib/calendar/schedule-api-schemas";

export const runtime = "nodejs";

function parseMonthRange(month: string | null): { from: Date; to: Date } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      const anchor = new Date(y, m - 1, 15);
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    }
  }
  const anchor = new Date();
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/**
 * GET /api/schedule/events — intervalo visível + filtros (formato schedule DTO).
 * POST — cria CalendarEvent a partir do payload schedule.
 */
export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(req.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const month = url.searchParams.get("month");
  const casoId = url.searchParams.get("caso_id");
  const responsavelId = url.searchParams.get("responsavel_id");
  const eventTypeSlug = url.searchParams.get("event_type");
  const statusParam = url.searchParams.get("status");
  const includeDone = url.searchParams.get("include_done") !== "false";
  const includeCancelled = url.searchParams.get("include_cancelled") === "true";

  let from: Date;
  let to: Date;
  if (fromRaw && toRaw) {
    from = new Date(fromRaw);
    to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Parâmetros from/to inválidos" }, { status: 400 });
    }
  } else {
    const r = parseMonthRange(month);
    from = r.from;
    to = r.to;
  }

  let prismaEventType: CalendarEventType | undefined;
  if (eventTypeSlug && (SCHEDULE_EVENT_TYPES as readonly string[]).includes(eventTypeSlug)) {
    prismaEventType = scheduleTypeToPrisma(eventTypeSlug);
  }

  let statusFilter: string | undefined;
  if (statusParam && (Object.values(CalendarEventStatus) as string[]).includes(statusParam)) {
    statusFilter = statusParam;
  }

  const excludeStatuses: CalendarEventStatus[] = [];
  if (!statusFilter) {
    if (!includeDone) excludeStatuses.push(CalendarEventStatus.DONE);
    if (!includeCancelled) excludeStatuses.push(CalendarEventStatus.CANCELLED);
  }

  const rows = await listCalendarEvents({
    workspaceId,
    from,
    to,
    caseId: casoId || undefined,
    assignedToUserId: responsavelId || undefined,
    eventType: prismaEventType,
    status: statusFilter ?? null,
    excludeStatuses: excludeStatuses.length > 0 ? excludeStatuses : undefined,
  });

  const events = rows.map(calendarRowToScheduleDto);
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  let body: ScheduleEventPostBody;
  try {
    body = scheduleEventPostSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const allDay = body.all_day === true;
  let startsAt: Date;
  let endsAt: Date | null;
  try {
    if (allDay) {
      startsAt = scheduleDateTimeToUtcDate(body.date, "00:00");
      endsAt = scheduleDateTimeToUtcDate(body.date, "23:59");
    } else {
      startsAt = scheduleDateTimeToUtcDate(body.date, body.start);
      endsAt = scheduleDateTimeEndOrDefault(startsAt, body.end ?? null);
    }
  } catch {
    return NextResponse.json({ error: "Data ou hora inválida" }, { status: 400 });
  }

  if (body.responsavel_id) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId, userId: body.responsavel_id },
      select: { id: true },
    });
    if (!m) {
      return NextResponse.json({ error: "Responsável não pertence a este workspace." }, { status: 400 });
    }
  }

  try {
    await validateCalendarEventLinks({
      workspaceId,
      caseId: body.caso_id ?? null,
      legalProcessId: body.legal_process_id ?? null,
      processId: body.processo_id ?? null,
      documentId: body.document_id ?? null,
    });
  } catch (e) {
    if (e instanceof CalendarValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const row = await prisma.calendarEvent.create({
    data: {
      workspaceId,
      title: body.title,
      description: body.obs ?? null,
      location: body.local ?? null,
      eventType: scheduleTypeToPrisma(body.type),
      status: CalendarEventStatus.PENDING,
      startsAt,
      endsAt,
      allDay,
      timezone: "America/Sao_Paulo",
      caseId: body.caso_id ?? null,
      legalProcessId: body.legal_process_id ?? null,
      processId: body.processo_id ?? null,
      documentId: body.document_id ?? null,
      assignedToUserId: body.responsavel_id ?? null,
      createdByUserId: user.id,
      source: CalendarEventSource.MANUAL,
      requiresHumanReview: false,
    },
    include: calendarEventListInclude,
  });

  return NextResponse.json({ event: calendarRowToScheduleDto(row) }, { status: 201 });
}
