import { CalendarEventSource, CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { calendarDateKeyInTimeZone, CALENDAR_DISPLAY_TIMEZONE } from "@/lib/calendar/calendar-labels";
import type { CalendarEventWithRelations } from "@/lib/calendar/calendar-queries";
import { hourMinuteInAgendaTz } from "@/lib/calendar/agenda-zoned-time";

/** Contrato público `/api/schedule/events` (alinhado ao modelo LEX agenda). */
export const SCHEDULE_EVENT_TYPES = [
  "audiencia",
  "prazo",
  "reuniao",
  "intimacao",
  "followup",
  "interno",
] as const;
export type ScheduleEventType = (typeof SCHEDULE_EVENT_TYPES)[number];

export type ScheduleEventStatus = CalendarEventStatus;

export type ScheduleEventDto = {
  id: string;
  title: string;
  caso_id: string | null;
  caso_title: string | null;
  processo_id: string | null;
  legal_process_id: string | null;
  document_id: string | null;
  /** CNJ formatado ou número interno do processo, para leitura rápida. */
  cnj: string | null;
  process_label: string | null;
  responsavel_id: string | null;
  responsavel_label: string | null;
  type: ScheduleEventType;
  prisma_event_type: CalendarEventType;
  status: ScheduleEventStatus;
  all_day: boolean;
  date: string;
  start: string;
  end: string | null;
  local: string | null;
  obs: string | null;
  source: CalendarEventSource;
  requires_human_review: boolean;
};

export function prismaEventTypeToSchedule(t: CalendarEventType): ScheduleEventType {
  const m: Record<CalendarEventType, ScheduleEventType> = {
    HEARING: "audiencia",
    REVIEW_DEADLINE: "prazo",
    CLIENT_MEETING: "reuniao",
    REVIEW_COMMUNICATION: "intimacao",
    FOLLOW_UP: "followup",
    INTERNAL_TASK: "interno",
    OTHER: "interno",
  };
  return m[t] ?? "interno";
}

export function scheduleTypeToPrisma(t: string): CalendarEventType {
  const m: Record<string, CalendarEventType> = {
    audiencia: "HEARING",
    prazo: "REVIEW_DEADLINE",
    reuniao: "CLIENT_MEETING",
    intimacao: "REVIEW_COMMUNICATION",
    followup: "FOLLOW_UP",
    interno: "INTERNAL_TASK",
  };
  return m[t] ?? "OTHER";
}

export function calendarRowToScheduleDto(e: CalendarEventWithRelations): ScheduleEventDto {
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const date = calendarDateKeyInTimeZone(e.startsAt, tz);
  const sh = hourMinuteInAgendaTz(e.startsAt);
  const start = `${String(sh.hour).padStart(2, "0")}:${String(sh.minute).padStart(2, "0")}`;
  let end: string | null = null;
  if (e.endsAt) {
    const eh = hourMinuteInAgendaTz(e.endsAt);
    end = `${String(eh.hour).padStart(2, "0")}:${String(eh.minute).padStart(2, "0")}`;
  }
  const cnj = e.legalProcess?.cnjFormatted ?? e.process?.number ?? null;
  const processLabel =
    (e.process?.title && e.process.title.trim()) ||
    e.process?.number ||
    e.legalProcess?.cnjFormatted ||
    null;
  const responsavelLabel = e.assignedTo?.name?.trim() || e.assignedTo?.email || null;
  return {
    id: e.id,
    title: e.title,
    caso_id: e.caseId,
    caso_title: e.case?.title ?? null,
    processo_id: e.processId,
    legal_process_id: e.legalProcessId,
    document_id: e.documentId,
    cnj,
    process_label: processLabel,
    responsavel_id: e.assignedToUserId,
    responsavel_label: responsavelLabel,
    type: prismaEventTypeToSchedule(e.eventType),
    prisma_event_type: e.eventType,
    status: e.status,
    all_day: e.allDay,
    date,
    start,
    end,
    local: e.location ?? null,
    obs: e.description ?? null,
    source: e.source,
    requires_human_review: e.requiresHumanReview,
  };
}

/** `yyyy-MM-dd` + `HH:mm` no calendário local (mesmo critério da agenda). */
export function scheduleDateTimeToUtcDate(dateStr: string, timeHm: string): Date {
  const dp = dateStr.split("-").map(Number);
  const tp = timeHm.split(":").map(Number);
  if (dp.length !== 3 || tp.length !== 2) {
    throw new Error("Data ou hora inválida");
  }
  const y = dp[0]!;
  const mo = dp[1]!;
  const d = dp[2]!;
  const h = tp[0]!;
  const mi = tp[1]!;
  if (![y, mo, d, h, mi].every((n) => Number.isFinite(n))) {
    throw new Error("Data ou hora inválida");
  }
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function scheduleDateTimeEndOrDefault(startsAt: Date, endHm: string | null | undefined): Date | null {
  if (!endHm || !/^\d{1,2}:\d{2}$/.test(endHm)) {
    return new Date(startsAt.getTime() + 60 * 60 * 1000);
  }
  const tp = endHm.split(":").map(Number);
  if (tp.length !== 2) {
    return new Date(startsAt.getTime() + 60 * 60 * 1000);
  }
  const h = tp[0]!;
  const mi = tp[1]!;
  if (![h, mi].every((n) => Number.isFinite(n))) {
    return new Date(startsAt.getTime() + 60 * 60 * 1000);
  }
  const end = new Date(startsAt);
  end.setHours(h, mi, 0, 0);
  if (end <= startsAt) {
    return new Date(startsAt.getTime() + 30 * 60 * 1000);
  }
  return end;
}
