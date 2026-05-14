import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { CalendarEventWithRelations } from "@/lib/calendar/calendar-queries";
import {
  CALENDAR_EVENT_STATUS_LABEL_PT,
  CALENDAR_EVENT_TYPE_LABEL_PT,
} from "@/lib/calendar/calendar-labels";
import { buildAgendaHref, type AgendaUrlState } from "@/lib/calendar/agenda-url-state";
import { CalendarEventCompleteButton } from "@/components/calendar/calendar-event-complete-button";

export function AgendaSelectedEventPanel({
  event,
  urlState,
}: {
  event: CalendarEventWithRelations;
  urlState: AgendaUrlState;
}) {
  const closeHref = buildAgendaHref(urlState, { event: undefined });

  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-[color:var(--border-subtle)] pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Detalhe do evento</p>
          <h2 className="mt-1 break-words text-lg font-semibold leading-snug text-[color:var(--text-primary)]">
            {event.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-caption">
              {CALENDAR_EVENT_TYPE_LABEL_PT[event.eventType]}
            </Badge>
            <Badge variant="secondary" className="text-caption">
              {CALENDAR_EVENT_STATUS_LABEL_PT[event.status]}
            </Badge>
            {event.requiresHumanReview ? (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-100">Revisão humana</span>
            ) : null}
          </div>
        </div>
        <Link
          href={closeHref}
          className="shrink-0 rounded-md border border-[color:var(--border-subtle)] px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-[color:var(--surface-elevated)]"
        >
          Fechar
        </Link>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Início</dt>
          <dd className="text-[color:var(--text-primary)]">
            {format(event.startsAt, "EEEE, d 'de' MMMM yyyy · HH:mm", { locale: ptBR })}
          </dd>
        </div>
        {event.endsAt ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Fim</dt>
            <dd className="text-[color:var(--text-primary)]">
              {format(event.endsAt, "EEEE, d 'de' MMMM yyyy · HH:mm", { locale: ptBR })}
            </dd>
          </div>
        ) : null}
        {event.allDay ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Dia inteiro</dt>
            <dd className="text-[color:var(--text-primary)]">Sim</dd>
          </div>
        ) : null}
        {event.assignedTo ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Responsável</dt>
            <dd className="text-[color:var(--text-primary)]">{event.assignedTo.name ?? event.assignedTo.email}</dd>
          </div>
        ) : null}
        {event.case ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Caso</dt>
            <dd>
              <Link href={`/cases/${event.case.id}`} className="font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400">
                {event.case.title}
              </Link>
            </dd>
          </div>
        ) : null}
        {event.process ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Processo</dt>
            <dd>
              <Link href={`/processos/${event.process.id}`} className="font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400">
                {event.process.title?.trim() || event.process.number}
              </Link>
            </dd>
          </div>
        ) : null}
        {event.description ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Descrição</dt>
            <dd className="whitespace-pre-wrap text-[color:var(--text-primary)]">{event.description}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--border-subtle)] pt-3">
        <CalendarEventCompleteButton eventId={event.id} status={event.status} />
      </div>
    </div>
  );
}
