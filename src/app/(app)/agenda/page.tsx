import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEventType } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listCalendarEvents, getCalendarDashboardBuckets } from "@/lib/calendar/calendar-queries";
import { calendarDateKeyInTimeZone, CALENDAR_DISPLAY_TIMEZONE, CALENDAR_EVENT_TYPE_LABEL_PT } from "@/lib/calendar/calendar-labels";
import { lexPageLeadClassName, lexPageTitleClassName } from "@/lib/lex-ds";
import { CalendarEventList, CalendarMonthGrid } from "@/components/calendar/calendar-event-list";
import { NewCalendarEventDialog } from "@/components/calendar/new-calendar-event-dialog";
import { SetPageTitle } from "@/components/app/set-page-title";
import { cn } from "@/lib/utils";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    caseId?: string;
    processId?: string;
    assignedToUserId?: string;
    eventType?: string;
  }>;
}) {
  const sp = await searchParams;
  const { workspaceId } = await getWorkspaceContext();

  const caseId = sp.caseId?.trim() || undefined;
  const processId = sp.processId?.trim() || undefined;
  const assignedToUserId = sp.assignedToUserId?.trim() || undefined;
  const eventType = sp.eventType?.trim() || undefined;

  const monthStr = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : format(new Date(), "yyyy-MM");
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const anchor =
    Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12 ? new Date(y, m - 1, 15) : new Date();
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const [monthEvents, buckets, members, cases] = await Promise.all([
    listCalendarEvents({
      workspaceId,
      from: monthStart,
      to: monthEnd,
      caseId: caseId ?? null,
      processId: processId ?? null,
      assignedToUserId: assignedToUserId ?? null,
      eventType: eventType ?? null,
    }),
    getCalendarDashboardBuckets(workspaceId),
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.case.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, title: true },
    }),
  ]);

  const memberOptions = members.map((mem) => ({
    id: mem.user.id,
    name: mem.user.name,
    email: mem.user.email,
  }));

  function matchFilters(e: (typeof monthEvents)[number]) {
    if (caseId && e.caseId !== caseId) return false;
    if (processId && e.processId !== processId) return false;
    if (assignedToUserId && e.assignedToUserId !== assignedToUserId) return false;
    if (eventType && e.eventType !== eventType) return false;
    return true;
  }

  const todayFiltered = buckets.today.filter(matchFilters);
  const upcomingFiltered = buckets.upcoming7d.filter(matchFilters);

  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const eventCountByDayKey = new Map<string, number>();
  for (const e of monthEvents) {
    const key = calendarDateKeyInTimeZone(e.startsAt, tz);
    eventCountByDayKey.set(key, (eventCountByDayKey.get(key) ?? 0) + 1);
  }

  const prevMonth = format(addMonths(anchor, -1), "yyyy-MM");
  const nextMonth = format(addMonths(anchor, 1), "yyyy-MM");

  type AgendaQS = {
    month?: string;
    caseId?: string;
    processId?: string;
    assignedToUserId?: string;
    eventType?: string;
  };

  function q(extra: AgendaQS) {
    const p = new URLSearchParams();
    p.set("month", extra.month ?? monthStr);
    if (extra.caseId) p.set("caseId", extra.caseId);
    if (extra.processId) p.set("processId", extra.processId);
    if (extra.assignedToUserId) p.set("assignedToUserId", extra.assignedToUserId);
    if (extra.eventType) p.set("eventType", extra.eventType);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  const typeKeys = Object.keys(CALENDAR_EVENT_TYPE_LABEL_PT) as CalendarEventType[];

  return (
    <>
      <SetPageTitle title="Agenda" />
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className={lexPageTitleClassName}>Agenda jurídica</h1>
            <p className={lexPageLeadClassName}>
              Compromissos internos do escritório, ligados a casos e processos. Sem sincronização com Google Calendar
              nesta versão.
            </p>
          </div>
          <NewCalendarEventDialog
            members={memberOptions}
            label="Novo evento"
            caseId={caseId}
            processId={processId}
          />
        </header>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mês:</span>
          <Link
            href={`/agenda${q({ month: prevMonth, caseId, processId, assignedToUserId, eventType })}`}
            className="rounded-md border border-input px-2 py-1 hover:bg-accent"
          >
            ← {format(addMonths(anchor, -1), "MMM yyyy", { locale: ptBR })}
          </Link>
          <span className="font-medium capitalize">{format(anchor, "MMMM yyyy", { locale: ptBR })}</span>
          <Link
            href={`/agenda${q({ month: nextMonth, caseId, processId, assignedToUserId, eventType })}`}
            className="rounded-md border border-input px-2 py-1 hover:bg-accent"
          >
            {format(addMonths(anchor, 1), "MMM yyyy", { locale: ptBR })} →
          </Link>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Caso</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/agenda${q({ month: monthStr })}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                !caseId ? "border-violet-500/60 bg-violet-500/10" : "border-input hover:bg-accent",
              )}
            >
              Todos
            </Link>
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/agenda${q({ month: monthStr, caseId: c.id, processId, assignedToUserId, eventType })}`}
                className={cn(
                  "max-w-[200px] truncate rounded-full border px-3 py-1 text-xs",
                  caseId === c.id ? "border-violet-500/60 bg-violet-500/10" : "border-input hover:bg-accent",
                )}
                title={c.title}
              >
                {c.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Responsável</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/agenda${q({ month: monthStr, caseId, processId, eventType })}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                !assignedToUserId ? "border-violet-500/60 bg-violet-500/10" : "border-input hover:bg-accent",
              )}
            >
              Todos
            </Link>
            {memberOptions.map((mem) => (
              <Link
                key={mem.id}
                href={`/agenda${q({
                  month: monthStr,
                  caseId,
                  processId,
                  assignedToUserId: mem.id,
                  eventType,
                })}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  assignedToUserId === mem.id ? "border-violet-500/60 bg-violet-500/10" : "border-input hover:bg-accent",
                )}
              >
                {mem.name?.trim() || mem.email}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Tipo</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/agenda${q({ month: monthStr, caseId, processId, assignedToUserId })}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                !eventType ? "border-violet-500/60 bg-violet-500/10" : "border-input hover:bg-accent",
              )}
            >
              Todos
            </Link>
            {typeKeys.map((t) => (
              <Link
                key={t}
                href={`/agenda${q({
                  month: monthStr,
                  caseId,
                  processId,
                  assignedToUserId,
                  eventType: t,
                })}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  eventType === t ? "border-violet-500/60 bg-violet-500/10" : "border-input hover:bg-accent",
                )}
              >
                {CALENDAR_EVENT_TYPE_LABEL_PT[t]}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="lex-glass-card space-y-3 rounded-2xl border border-[color:var(--border-subtle)] p-4 md:p-5">
              <h2 className="text-sm font-semibold">Hoje</h2>
              <CalendarEventList events={todayFiltered} emptyLabel="Nada agendado para hoje." />
            </div>
            <div className="lex-glass-card space-y-3 rounded-2xl border border-[color:var(--border-subtle)] p-4 md:p-5">
              <h2 className="text-sm font-semibold">Próximos 7 dias</h2>
              <CalendarEventList events={upcomingFiltered} emptyLabel="Sem compromissos nesta janela." />
            </div>
            <div className="lex-glass-card space-y-3 rounded-2xl border border-[color:var(--border-subtle)] p-4 md:p-5">
              <h2 className="text-sm font-semibold">Neste mês (lista)</h2>
              <CalendarEventList events={monthEvents} emptyLabel="Nenhum evento no mês com os filtros atuais." />
            </div>
          </div>
          <CalendarMonthGrid
            days={gridDays}
            eventCountByDayKey={eventCountByDayKey}
            monthLabel={format(anchor, "MMMM yyyy", { locale: ptBR })}
            anchorMonth={anchor}
          />
        </div>
      </div>
    </>
  );
}
