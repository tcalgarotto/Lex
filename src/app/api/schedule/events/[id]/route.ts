import { NextResponse } from "next/server";
import { z } from "zod";
import { CalendarEventStatus, type CalendarEventType } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { hourMinuteInAgendaTz } from "@/lib/calendar/agenda-zoned-time";
import { calendarEventListInclude } from "@/lib/calendar/calendar-queries";
import { CALENDAR_DISPLAY_TIMEZONE, calendarDateKeyInTimeZone } from "@/lib/calendar/calendar-labels";
import {
  calendarRowToScheduleDto,
  scheduleDateTimeEndOrDefault,
  scheduleDateTimeToUtcDate,
  scheduleTypeToPrisma,
  SCHEDULE_EVENT_TYPES,
} from "@/lib/calendar/schedule-shapes";
import { assertCalendarEventInWorkspace, CalendarValidationError, validateCalendarEventLinks } from "@/lib/calendar/calendar-validation";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    status: z.nativeEnum(CalendarEventStatus).optional(),
    title: z.string().min(1).max(500).optional(),
    local: z.string().max(500).nullable().optional(),
    obs: z.string().max(20000).nullable().optional(),
    caso_id: z.string().nullable().optional(),
    responsavel_id: z.string().nullable().optional(),
    processo_id: z.string().nullable().optional(),
    legal_process_id: z.string().nullable().optional(),
    document_id: z.string().nullable().optional(),
    type: z.enum(SCHEDULE_EVENT_TYPES).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
    end: z.union([z.string().regex(/^\d{1,2}:\d{2}$/), z.null()]).optional(),
    all_day: z.boolean().optional(),
  })
  .strict();

/**
 * PATCH /api/schedule/events/[id] — atualização parcial no formato schedule (mapeia para CalendarEvent).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  try {
    await assertCalendarEventInWorkspace(workspaceId, id);
  } catch (e) {
    if (e instanceof CalendarValidationError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
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

  const nextCaseId = body.caso_id !== undefined ? body.caso_id : undefined;
  const nextLp = body.legal_process_id !== undefined ? body.legal_process_id : undefined;
  const nextPi = body.processo_id !== undefined ? body.processo_id : undefined;
  const nextDoc = body.document_id !== undefined ? body.document_id : undefined;

  const scheduleTouch =
    body.date !== undefined || body.start !== undefined || body.end !== undefined || body.all_day !== undefined;

  const cur = await prisma.calendarEvent.findFirstOrThrow({
    where: { id, workspaceId },
    select: {
      startsAt: true,
      endsAt: true,
      allDay: true,
      eventType: true,
      caseId: true,
      legalProcessId: true,
      processId: true,
      documentId: true,
    },
  });

  if (nextCaseId !== undefined || nextLp !== undefined || nextPi !== undefined || nextDoc !== undefined) {
    try {
      await validateCalendarEventLinks({
        workspaceId,
        caseId: nextCaseId !== undefined ? nextCaseId : cur.caseId,
        legalProcessId: nextLp !== undefined ? nextLp : cur.legalProcessId,
        processId: nextPi !== undefined ? nextPi : cur.processId,
        documentId: nextDoc !== undefined ? nextDoc : cur.documentId,
      });
    } catch (e) {
      if (e instanceof CalendarValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  }

  const tz = CALENDAR_DISPLAY_TIMEZONE;
  let nextStartsAt: Date | undefined;
  let nextEndsAt: Date | null | undefined;
  let nextAllDay: boolean | undefined;
  let nextEventType: CalendarEventType | undefined;

  if (body.type !== undefined) {
    nextEventType = scheduleTypeToPrisma(body.type);
  }

  if (scheduleTouch) {
    const dateKey = body.date ?? calendarDateKeyInTimeZone(cur.startsAt, tz);
    const mergedAllDay = body.all_day !== undefined ? body.all_day : cur.allDay;
    nextAllDay = mergedAllDay;
    try {
      if (mergedAllDay) {
        nextStartsAt = scheduleDateTimeToUtcDate(dateKey, "00:00");
        nextEndsAt = scheduleDateTimeToUtcDate(dateKey, "23:59");
      } else {
        const startHm =
          body.start ??
          (() => {
            const h = hourMinuteInAgendaTz(cur.startsAt);
            return `${String(h.hour).padStart(2, "0")}:${String(h.minute).padStart(2, "0")}`;
          })();
        nextStartsAt = scheduleDateTimeToUtcDate(dateKey, startHm);
        let endHm: string | null = null;
        if (body.end !== undefined) {
          endHm = body.end;
        } else if (cur.endsAt) {
          const eh = hourMinuteInAgendaTz(cur.endsAt);
          endHm = `${String(eh.hour).padStart(2, "0")}:${String(eh.minute).padStart(2, "0")}`;
        }
        nextEndsAt = scheduleDateTimeEndOrDefault(nextStartsAt, endHm);
      }
    } catch {
      return NextResponse.json({ error: "Data ou hora inválida" }, { status: 400 });
    }
  }

  const row = await prisma.calendarEvent.update({
    where: { id, workspaceId },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.local !== undefined ? { location: body.local } : {}),
      ...(body.obs !== undefined ? { description: body.obs } : {}),
      ...(body.caso_id !== undefined ? { caseId: body.caso_id } : {}),
      ...(body.responsavel_id !== undefined ? { assignedToUserId: body.responsavel_id } : {}),
      ...(body.processo_id !== undefined ? { processId: body.processo_id } : {}),
      ...(body.legal_process_id !== undefined ? { legalProcessId: body.legal_process_id } : {}),
      ...(body.document_id !== undefined ? { documentId: body.document_id } : {}),
      ...(nextEventType !== undefined ? { eventType: nextEventType } : {}),
      ...(nextStartsAt !== undefined ? { startsAt: nextStartsAt } : {}),
      ...(nextEndsAt !== undefined ? { endsAt: nextEndsAt } : {}),
      ...(nextAllDay !== undefined ? { allDay: nextAllDay } : {}),
    },
    include: calendarEventListInclude,
  });

  return NextResponse.json({ event: calendarRowToScheduleDto(row) });
}
