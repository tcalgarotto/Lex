import Link from "next/link";
import { listCalendarEventsForCase } from "@/lib/calendar/calendar-queries";
import { CalendarEventList } from "@/components/calendar/calendar-event-list";
import { NewCalendarEventDialog } from "@/components/calendar/new-calendar-event-dialog";
import { prisma } from "@/lib/prisma";

export async function CaseCalendarSection({
  workspaceId,
  caseId,
}: {
  workspaceId: string;
  caseId: string;
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

  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-micro font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">Agenda</p>
          <p className="text-sm text-muted-foreground">Eventos internos ligados a este caso.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewCalendarEventDialog caseId={caseId} members={memberOptions} label="Novo evento" />
          <Link
            href={`/agenda?caseId=${caseId}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Ver na agenda
          </Link>
        </div>
      </div>
      <CalendarEventList events={events} emptyLabel="Nenhum evento associado a este caso." />
    </section>
  );
}
