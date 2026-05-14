import Link from "next/link";
import { format, getISODay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { CalendarEventWithRelations } from "@/lib/calendar/calendar-queries";
import {
  CALENDAR_EVENT_STATUS_LABEL_PT,
  CALENDAR_EVENT_TYPE_LABEL_PT,
} from "@/lib/calendar/calendar-labels";
import { cn } from "@/lib/utils";
import { CalendarEventCompleteButton } from "@/components/calendar/calendar-event-complete-button";

export function CalendarEventList({
  events,
  emptyLabel,
  eventHref,
}: {
  events: CalendarEventWithRelations[];
  emptyLabel: string;
  /** Se definido, o cartão principal liga ao detalhe na agenda (ex.: `?event=id`). */
  eventHref?: (eventId: string) => string;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id}>
          <div className="lex-glass-card flex flex-col gap-2 rounded-xl border border-[color:var(--border-subtle)] p-3 lex-transition hover:border-[color:var(--border-default)] sm:flex-row sm:items-stretch">
            <Link
              href={eventHref ? eventHref(e.id) : "/agenda"}
              className="min-w-0 flex-1 outline-none lex-transition hover:opacity-90"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 font-medium leading-snug text-[color:var(--text-primary)]">{e.title}</p>
                <Badge variant="outline" className="shrink-0 whitespace-nowrap text-caption">
                  {CALENDAR_EVENT_TYPE_LABEL_PT[e.eventType]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(e.startsAt, "EEE d MMM · HH:mm", { locale: ptBR })}
                {e.assignedTo ? ` · ${e.assignedTo.name ?? e.assignedTo.email}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{CALENDAR_EVENT_STATUS_LABEL_PT[e.status]}</span>
                {e.requiresHumanReview ? (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-100">Revisão humana</span>
                ) : null}
                {e.case ? <span className="truncate">Caso: {e.case.title}</span> : null}
                {e.process ? (
                  <span className="truncate">
                    Proc.: {e.process.title?.trim() || e.process.number}
                  </span>
                ) : null}
              </div>
            </Link>
            <div className="flex shrink-0 items-start sm:flex-col sm:items-end">
              <CalendarEventCompleteButton eventId={e.id} status={e.status} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Seg–Dom (ISO): mesma ordem que `getISODay` na grade. */
const CALENDAR_WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type CalendarMonthDayEvents = {
  total: number;
  /** Até 2 títulos, ordenados por horário (definido na página). */
  previewTitles: string[];
};

function truncateTitle(title: string, max = 28): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function CalendarMonthGrid({
  days,
  monthLabel,
  anchorMonth,
  eventsByDayKey,
  todayKey,
  dayHref,
}: {
  days: Date[];
  monthLabel: string;
  anchorMonth: Date;
  eventsByDayKey: Map<string, CalendarMonthDayEvents>;
  /** `YYYY-MM-DD` no mesmo fuso de `eventsByDayKey` (ex.: CALENDAR_DISPLAY_TIMEZONE). */
  todayKey: string;
  /** Navegação ao clicar no dia (ex.: vista dia). */
  dayHref?: (dayKey: string) => string;
}) {
  const cellClass = (inMonth: boolean, isWeekend: boolean) =>
    cn(
      "flex min-h-[5.75rem] flex-col border-0 bg-[color:var(--surface-card)] px-1 py-1 text-left outline-none transition-colors hover:bg-[color:var(--surface-overlay)] md:min-h-[6.5rem]",
      isWeekend && "bg-[color:var(--surface-elevated)]",
      !inMonth && "opacity-[0.38]",
    );

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] p-2 shadow-sm md:p-2">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1 pt-1">
        <h2 className="text-sm font-semibold capitalize leading-tight text-[color:var(--text-primary)]">
          {monthLabel}
        </h2>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mês</p>
      </div>

      <div
        className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--border-subtle)]"
        role="grid"
        aria-label={`Calendário de ${monthLabel}`}
      >
        {CALENDAR_WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="flex items-center justify-center bg-[color:var(--surface-card)] py-2 text-center"
            role="columnheader"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          </div>
        ))}

        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, anchorMonth);
          const isoDow = getISODay(d);
          const isWeekend = isoDow === 6 || isoDow === 7;
          const cell = eventsByDayKey.get(key);
          const total = cell?.total ?? 0;
          const previews = cell?.previewTitles ?? [];
          const isToday = key === todayKey;
          const more = total > previews.length ? total - previews.length : 0;

          const body = (
            <>
              <div className="flex shrink-0 items-start justify-start px-0.5 pt-0.5">
                <span
                  className={cn(
                    "inline-flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center tabular-nums text-xs leading-none text-muted-foreground",
                    isToday &&
                      "rounded-full bg-rose-500 px-1.5 py-1 text-xs font-semibold text-white dark:bg-rose-600",
                  )}
                >
                  {format(d, "dd")}
                </span>
              </div>

              {total > 0 ? (
                <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5">
                  {previews.map((title, i) => (
                    <div
                      key={`${key}-p${i}`}
                      className="flex min-w-0 items-center gap-1 rounded-sm px-0.5 py-px"
                      title={title}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400"
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-[11px] leading-snug text-[color:var(--text-primary)] md:text-xs">
                        {truncateTitle(title)}
                      </span>
                    </div>
                  ))}
                  {more > 0 ? (
                    <p className="pl-3 text-[10px] font-semibold leading-tight text-sky-600 dark:text-sky-400">
                      +{more} {more === 1 ? "outro" : "outros"}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          );

          if (dayHref) {
            return (
              <Link
                key={key}
                href={dayHref(key)}
                role="gridcell"
                className={cellClass(inMonth, isWeekend)}
              >
                {body}
              </Link>
            );
          }

          return (
            <div key={key} role="gridcell" className={cellClass(inMonth, isWeekend)}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
