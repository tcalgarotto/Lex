import Link from "next/link";
import { addMonths, format, getISODay, isSameMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { buildAgendaHref, monthGridDays, type AgendaUrlState } from "@/lib/calendar/agenda-url-state";
import { CALENDAR_DISPLAY_TIMEZONE } from "@/lib/calendar/calendar-labels";

export function AgendaMiniMonth({
  monthStr,
  urlState,
  todayKey,
}: {
  monthStr: string;
  urlState: AgendaUrlState;
  todayKey: string;
}) {
  const { days, anchorMonth } = monthGridDays(monthStr);
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const weekLabels = ["S", "T", "Q", "Q", "S", "S", "D"];

  const prevStart = startOfMonth(addMonths(anchorMonth, -1));
  const nextStart = startOfMonth(addMonths(anchorMonth, 1));
  const prev = buildAgendaHref(urlState, {
    month: format(prevStart, "yyyy-MM"),
    date: format(prevStart, "yyyy-MM-dd"),
  });
  const next = buildAgendaHref(urlState, {
    month: format(nextStart, "yyyy-MM"),
    date: format(nextStart, "yyyy-MM-dd"),
  });

  return (
    <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-2">
      <div className="mb-2 flex items-center justify-between gap-1">
        <p className="truncate text-sm font-medium capitalize text-[color:var(--text-primary)]">
          {format(anchorMonth, "MMMM yyyy", { locale: ptBR })}
        </p>
        <div className="flex shrink-0 gap-0.5">
          <Link
            href={prev}
            className="flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-elevated)]"
            aria-label="Mês anterior"
          >
            ‹
          </Link>
          <Link
            href={next}
            className="flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-elevated)]"
            aria-label="Próximo mês"
          >
            ›
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] font-medium text-muted-foreground">
        {weekLabels.map((l, i) => (
          <div key={i} className="py-1">
            {l}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-px">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, anchorMonth);
          const isToday = key === todayKey;
          const iso = getISODay(d);
          const isWeekend = iso === 6 || iso === 7;
          const href = buildAgendaHref(urlState, {
            date: key,
            month: format(d, "yyyy-MM"),
            view: urlState.view === "month" ? "month" : "day",
          });
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex aspect-square min-h-[1.75rem] items-center justify-center rounded-md text-[11px] tabular-nums transition-colors",
                inMonth ? "text-[color:var(--text-primary)]" : "text-muted-foreground/50",
                isWeekend && inMonth && "bg-[color:var(--surface-elevated)]/80",
                isToday && "bg-rose-500 font-semibold text-white hover:bg-rose-600 dark:bg-rose-600",
              )}
            >
              {format(d, "d")}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Fuso: {tz.replaceAll("_", " ")} · clique num dia para focar na agenda.
      </p>
    </div>
  );
}
