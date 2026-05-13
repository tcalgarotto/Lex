import Link from "next/link";
import { listCalendarEventsForProcess } from "@/lib/calendar/calendar-queries";
import { CalendarEventList } from "@/components/calendar/calendar-event-list";
import { NewCalendarEventDialog } from "@/components/calendar/new-calendar-event-dialog";
import { prisma } from "@/lib/prisma";

export async function ProcessCalendarTab({
  workspaceId,
  processId,
  legalProcessId,
}: {
  workspaceId: string;
  processId: string;
  legalProcessId: string | null;
}) {
  const [events, members] = await Promise.all([
    listCalendarEventsForProcess(workspaceId, processId, legalProcessId),
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Eventos ligados a este processo interno ou ao processo judicial DataJud associado.
        </p>
        <div className="flex flex-wrap gap-2">
          <NewCalendarEventDialog
            members={memberOptions}
            processId={processId}
            legalProcessId={legalProcessId ?? undefined}
            label="Novo evento"
          />
          <Link
            href={`/agenda?processId=${processId}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Ver na agenda
          </Link>
        </div>
      </div>
      <CalendarEventList events={events} emptyLabel="Nenhum evento associado a este processo." />
    </div>
  );
}
