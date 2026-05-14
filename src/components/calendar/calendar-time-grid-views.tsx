import Link from "next/link";
import type { CSSProperties } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarEventWithRelations } from "@/lib/calendar/calendar-queries";
import {
  calendarDateKeyInTimeZone,
  CALENDAR_DISPLAY_TIMEZONE,
  CALENDAR_EVENT_TYPE_LABEL_PT,
} from "@/lib/calendar/calendar-labels";
import { buildAgendaHref, type AgendaUrlState } from "@/lib/calendar/agenda-url-state";
import { hourMinuteInAgendaTz } from "@/lib/calendar/agenda-zoned-time";
import { cn } from "@/lib/utils";

export const AGENDA_TIME_GRID_START_HOUR = 6;
export const AGENDA_TIME_GRID_END_HOUR = 22;
const PX_PER_HOUR = 52;

function typeAccentClass(eventType: CalendarEventWithRelations["eventType"]): string {
  switch (eventType) {
    case "HEARING":
      return "border-l-rose-500 bg-rose-500/15";
    case "CLIENT_MEETING":
      return "border-l-violet-500 bg-violet-500/15";
    case "REVIEW_DEADLINE":
      return "border-l-amber-500 bg-amber-500/15";
    case "REVIEW_COMMUNICATION":
      return "border-l-orange-500 bg-orange-500/15";
    case "FOLLOW_UP":
      return "border-l-cyan-500 bg-cyan-500/15";
    case "INTERNAL_TASK":
      return "border-l-sky-500 bg-sky-500/15";
    default:
      return "border-l-emerald-500 bg-emerald-500/15";
  }
}

function minutesFromGridStart(hour: number, minute: number): number {
  return (hour - AGENDA_TIME_GRID_START_HOUR) * 60 + minute;
}

function blockStyle(startsAt: Date, endsAt: Date | null): { top: number; height: number } {
  const { hour: sh, minute: sm } = hourMinuteInAgendaTz(startsAt);
  const end = endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
  const { hour: eh, minute: em } = hourMinuteInAgendaTz(end);
  const spanMin = Math.max(AGENDA_TIME_GRID_END_HOUR - AGENDA_TIME_GRID_START_HOUR, 1) * 60;
  let startM = minutesFromGridStart(sh, sm);
  let endM = (eh - AGENDA_TIME_GRID_START_HOUR) * 60 + em;
  if (endM <= startM) endM = startM + 30;
  startM = Math.max(0, Math.min(startM, spanMin - 15));
  endM = Math.max(startM + 15, Math.min(endM, spanMin));
  const top = (startM / 60) * PX_PER_HOUR;
  const height = Math.max(((endM - startM) / 60) * PX_PER_HOUR, 22);
  return { top, height };
}

function EventBlock({
  e,
  urlState,
  className,
  style,
}: {
  e: CalendarEventWithRelations;
  urlState: AgendaUrlState;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={buildAgendaHref(urlState, { event: e.id })}
      title={e.title}
      style={style}
      className={cn(
        "block overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-snug text-[color:var(--text-primary)] shadow-sm outline-none ring-offset-background hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring",
        typeAccentClass(e.eventType),
        className,
      )}
    >
      <span className="font-semibold tabular-nums">{format(e.startsAt, "HH:mm", { locale: ptBR })}</span>
      <span className="ml-1 font-medium">{e.title}</span>
      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
        {CALENDAR_EVENT_TYPE_LABEL_PT[e.eventType]}
      </span>
    </Link>
  );
}

export function CalendarWeekTimeGrid({
  weekDays,
  events,
  urlState,
}: {
  weekDays: Date[];
  events: CalendarEventWithRelations[];
  urlState: AgendaUrlState;
}) {
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const hours: number[] = [];
  for (let h = AGENDA_TIME_GRID_START_HOUR; h <= AGENDA_TIME_GRID_END_HOUR; h++) hours.push(h);

  const dayKeys = weekDays.map((d) => calendarDateKeyInTimeZone(d, tz));

  const allDayByDay = dayKeys.map((dk) =>
    events.filter((e) => e.allDay && calendarDateKeyInTimeZone(e.startsAt, tz) === dk),
  );

  const timedByDay = dayKeys.map((dk) =>
    events.filter((e) => !e.allDay && calendarDateKeyInTimeZone(e.startsAt, tz) === dk),
  );

  const gridHeight = (AGENDA_TIME_GRID_END_HOUR - AGENDA_TIME_GRID_START_HOUR) * PX_PER_HOUR;

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-sm">
      <div className="min-w-[780px]">
        <div
          className="grid border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]"
          style={{ gridTemplateColumns: `56px repeat(${weekDays.length}, minmax(0,1fr))` }}
        >
          <div />
          {weekDays.map((d) => {
            const dk = calendarDateKeyInTimeZone(d, tz);
            return (
              <Link
                key={dk}
                href={buildAgendaHref(urlState, { view: "day", date: dk, month: format(d, "yyyy-MM") })}
                className="border-l border-[color:var(--border-subtle)] px-1 py-2 text-center transition-colors hover:bg-[color:var(--surface-overlay)]"
              >
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {format(d, "EEE", { locale: ptBR })}
                </div>
                <div className="text-sm font-semibold tabular-nums text-[color:var(--text-primary)]">{format(d, "d")}</div>
              </Link>
            );
          })}
        </div>

        {allDayByDay.some((a) => a.length > 0) ? (
          <div
            className="grid border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]"
            style={{ gridTemplateColumns: `56px repeat(${weekDays.length}, minmax(0,1fr))` }}
          >
            <div className="px-1 py-1.5 text-[10px] font-medium leading-tight text-muted-foreground">Dia inteiro</div>
            {allDayByDay.map((list, idx) => (
              <div key={dayKeys[idx]} className="space-y-1 border-l border-[color:var(--border-subtle)] px-1 py-1">
                {list.map((e) => (
                  <EventBlock key={e.id} e={e} urlState={urlState} className="text-[11px]" />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `56px repeat(${weekDays.length}, minmax(0,1fr))`,
            minHeight: gridHeight,
          }}
        >
          <div className="border-r border-[color:var(--border-subtle)] text-right text-[10px] text-muted-foreground">
            {hours.map((h) => (
              <div key={h} style={{ height: PX_PER_HOUR }} className="pr-1 pt-0.5 font-medium tabular-nums">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {weekDays.map((d, colIdx) => {
            const dk = dayKeys[colIdx]!;
            const list = timedByDay[colIdx] ?? [];
            return (
              <div key={dk} className="relative border-l border-[color:var(--border-subtle)]">
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: PX_PER_HOUR }}
                    className="border-b border-[color:var(--border-subtle)]/50"
                  />
                ))}
                {list.map((e) => {
                  const { top, height } = blockStyle(e.startsAt, e.endsAt);
                  return (
                    <EventBlock
                      key={e.id}
                      e={e}
                      urlState={urlState}
                      className="absolute left-0.5 right-0.5 z-[1]"
                      style={{ top, height }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarDayTimeGrid({
  day,
  events,
  urlState,
}: {
  day: Date;
  events: CalendarEventWithRelations[];
  urlState: AgendaUrlState;
}) {
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const dk = calendarDateKeyInTimeZone(day, tz);
  const dayEvents = events.filter((e) => calendarDateKeyInTimeZone(e.startsAt, tz) === dk);
  const allDay = dayEvents.filter((e) => e.allDay);
  const timed = dayEvents.filter((e) => !e.allDay);

  const hours: number[] = [];
  for (let h = AGENDA_TIME_GRID_START_HOUR; h <= AGENDA_TIME_GRID_END_HOUR; h++) hours.push(h);
  const gridHeight = (AGENDA_TIME_GRID_END_HOUR - AGENDA_TIME_GRID_START_HOUR) * PX_PER_HOUR;

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-sm">
      {allDay.length > 0 ? (
        <div className="space-y-1 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Dia inteiro</p>
          <div className="flex flex-wrap gap-1">
            {allDay.map((e) => (
              <EventBlock key={e.id} e={e} urlState={urlState} className="max-w-full shrink-0" />
            ))}
          </div>
        </div>
      ) : null}
      <div className="relative grid" style={{ gridTemplateColumns: `56px minmax(0,1fr)`, minHeight: gridHeight }}>
        <div className="border-r border-[color:var(--border-subtle)] text-right text-[10px] text-muted-foreground">
          {hours.map((h) => (
            <div key={h} style={{ height: PX_PER_HOUR }} className="pr-1 pt-0.5 font-medium tabular-nums">
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              style={{ height: PX_PER_HOUR }}
              className="border-b border-[color:var(--border-subtle)]/50"
            />
          ))}
          {timed.map((e) => {
            const { top, height } = blockStyle(e.startsAt, e.endsAt);
            return (
              <EventBlock
                key={e.id}
                e={e}
                urlState={urlState}
                className="absolute left-1 right-1 z-[1]"
                style={{ top, height }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
