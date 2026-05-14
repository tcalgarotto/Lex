import Link from "next/link";
import { listCalendarEventsForCase } from "@/lib/calendar/calendar-queries";
import { CalendarEventList } from "@/components/calendar/calendar-event-list";
import { NewCalendarEventDialog } from "@/components/calendar/new-calendar-event-dialog";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export async function CaseCalendarSection({
  workspaceId,
  caseId,
  compact = false,
}: {
  workspaceId: string;
  caseId: string;
  /** Layout mais baixo para visão geral (duas colunas com processo). */
  compact?: boolean;
}) {
  const [events, members] = await Promise.all([
    listCalendarEventsForCase(workspaceId, caseId),
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  const next = events[0];
  const when = next ? new Date(next.startsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <section
      className={cn(
        "space-y-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)]",
        compact ? "p-3" : "space-y-3 p-4",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Agenda do caso
          </p>
          {compact ? (
            <p className="mt-0.5 truncate text-caption text-muted-foreground">
              {next ? `Próximo: ${when}` : "Nenhum evento agendado."}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Eventos internos ligados a este caso.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <NewCalendarEventDialog caseId={caseId} members={memberOptions} label="Novo evento" />
          <Link
            href={`/agenda?caseId=${caseId}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Ver na agenda
          </Link>
        </div>
      </div>
      {!compact ? (
        <CalendarEventList events={events} emptyLabel="Nenhum evento associado a este caso." />
      ) : events.length > 1 ? (
        <p className="text-caption text-muted-foreground">+{events.length - 1} outro(s) evento(s) — ver na agenda.</p>
      ) : null}
    </section>
  );
}
