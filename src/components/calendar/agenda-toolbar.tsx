import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildAgendaHref,
  formatToolbarTitle,
  monthKeyFromDate,
  navigateDate,
  parseLocalDateKey,
  todayDateKey,
  type AgendaUrlState,
} from "@/lib/calendar/agenda-url-state";
import { lexPageTitleClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export function AgendaToolbar({ urlState }: { urlState: AgendaUrlState }) {
  const today = todayDateKey();
  const todayAnchor = parseLocalDateKey(today) ?? new Date();
  const todayMonth = monthKeyFromDate(todayAnchor);

  return (
    <div className="flex flex-col gap-4 border-b border-[color:var(--border-subtle)] pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className={cn(lexPageTitleClassName, "capitalize")}>
            {formatToolbarTitle(urlState)}
          </h1>
          <p className="text-sm text-muted-foreground">Vista {urlState.view === "month" ? "mensal" : urlState.view === "week" ? "semanal" : "do dia"} · integração com os filtros da barra lateral.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-0.5 shadow-sm">
            {(["month", "week", "day"] as const).map((v) => (
              <Link
                key={v}
                href={buildAgendaHref(urlState, { view: v })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  urlState.view === v
                    ? "bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-primary)] shadow-sm"
                    : "text-muted-foreground hover:text-[color:var(--text-primary)]",
                )}
              >
                {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-0.5">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
              <Link href={buildAgendaHref(navigateDate(urlState, -1), {})} aria-label="Período anterior">
                ←
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium" asChild>
              <Link
                href={buildAgendaHref({ ...urlState, date: today, month: todayMonth }, {})}
                aria-label="Ir para hoje"
              >
                Hoje
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
              <Link href={buildAgendaHref(navigateDate(urlState, 1), {})} aria-label="Próximo período">
                →
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <form action="/agenda" method="get" className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="view" value={urlState.view} />
        <input type="hidden" name="month" value={urlState.month} />
        <input type="hidden" name="date" value={urlState.date} />
        {urlState.caseId ? <input type="hidden" name="caseId" value={urlState.caseId} /> : null}
        {urlState.processId ? <input type="hidden" name="processId" value={urlState.processId} /> : null}
        {urlState.assignedToUserId ? <input type="hidden" name="assignedToUserId" value={urlState.assignedToUserId} /> : null}
        {urlState.eventType ? <input type="hidden" name="eventType" value={urlState.eventType} /> : null}
        {urlState.event ? <input type="hidden" name="event" value={urlState.event} /> : null}
        <Input
          type="search"
          name="q"
          defaultValue={urlState.q ?? ""}
          placeholder="Buscar por título, descrição, caso…"
          className="max-w-xl flex-1"
          aria-label="Buscar eventos"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="secondary">
            Buscar
          </Button>
          {urlState.q ? (
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={buildAgendaHref(urlState, { q: undefined })}>Limpar</Link>
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
