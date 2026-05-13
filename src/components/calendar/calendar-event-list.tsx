import Link from "next/link";
import { format, isSameMonth } from "date-fns";
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
}: {
  events: CalendarEventWithRelations[];
  emptyLabel: string;
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
              href="/agenda"
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

export function CalendarMonthGrid({
  days,
  eventCountByDayKey,
  monthLabel,
  anchorMonth,
}: {
  days: Date[];
  eventCountByDayKey: Map<string, number>;
  monthLabel: string;
  anchorMonth: Date;
}) {
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return (
    <div className="lex-glass-card space-y-3 rounded-2xl border border-[color:var(--border-subtle)] p-4 md:p-5">
      <h2 className="text-section font-semibold text-[color:var(--text-primary)]">{monthLabel}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-caption font-medium text-[color:var(--text-secondary)]">
        {weekDays.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, anchorMonth);
          const n = eventCountByDayKey.get(key) ?? 0;
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[3rem] flex-col rounded-lg border border-transparent p-1 text-left text-sm",
                !inMonth && "opacity-40",
              )}
            >
              <span className="tabular-nums text-muted-foreground">{format(d, "d")}</span>
              {n > 0 ? (
                <span className="mt-1 inline-flex size-2 rounded-full bg-violet-500" title={`${n} evento(s)`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
