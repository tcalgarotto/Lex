import { CALENDAR_DISPLAY_TIMEZONE, calendarDateKeyInTimeZone } from "@/lib/calendar/calendar-labels";
import type { ScheduleEventDto } from "@/lib/calendar/schedule-shapes";

export type ScheduleFetchFilterParams = {
  from: Date;
  to: Date;
  casoId: string;
  responsavelId: string;
  eventTypeSlug: string;
  includeDone: boolean;
  includeCancelled: boolean;
};

export type ScheduleRangeCacheEntry = {
  events: ScheduleEventDto[];
  fetchedAt: number;
  expiresAt: number;
};

/** TTL padrão do cache de intervalo (ms). */
export const SCHEDULE_RANGE_CACHE_TTL_MS = 90_000;

/**
 * Chave estável para cache e deduplicação de GET /api/schedule/events.
 * Ordem e formato fixos para testes e debug.
 */
export function buildScheduleFetchKey(p: ScheduleFetchFilterParams): string {
  return [
    p.from.toISOString(),
    p.to.toISOString(),
    p.casoId.trim(),
    p.responsavelId.trim(),
    p.eventTypeSlug,
    p.includeDone ? "1" : "0",
    p.includeCancelled ? "1" : "0",
  ].join("|");
}

/** Verifica se o compromisso (data no fuso da agenda) intersecta o intervalo UTC pedido à API. */
export function eventDtoInFetchedRange(e: ScheduleEventDto, fromUtc: Date, toUtc: Date): boolean {
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const fromKey = calendarDateKeyInTimeZone(fromUtc, tz);
  const toKey = calendarDateKeyInTimeZone(toUtc, tz);
  return e.date >= fromKey && e.date <= toKey;
}

export function mergeEventIntoList(list: ScheduleEventDto[], next: ScheduleEventDto): ScheduleEventDto[] {
  const i = list.findIndex((x) => x.id === next.id);
  if (i === -1) return [...list, next];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

export function removeEventFromList(list: ScheduleEventDto[], id: string): ScheduleEventDto[] {
  return list.filter((x) => x.id !== id);
}
