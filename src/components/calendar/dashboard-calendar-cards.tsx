import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCalendarDashboardBuckets } from "@/lib/calendar/calendar-queries";
import { CalendarEventList } from "@/components/calendar/calendar-event-list";

export async function DashboardCalendarCards({ workspaceId }: { workspaceId: string }) {
  const { overdue, today, upcoming7d } = await getCalendarDashboardBuckets(workspaceId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-rose-500/20 bg-rose-500/[0.04]">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Atrasados</CardTitle>
            <CardDescription>Pendentes com data já passada — requerem atenção.</CardDescription>
          </div>
          {overdue.length > 0 ? (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-100">
              {overdue.length}
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          <CalendarEventList events={overdue} emptyLabel="Nenhum evento atrasado." />
          {overdue.length > 0 ? (
            <Button asChild variant="link" className="mt-3 h-auto px-0 text-sm">
              <Link href="/agenda">Abrir agenda</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Agenda de hoje</CardTitle>
            <CardDescription>Compromissos pendentes para hoje (fusos: São Paulo).</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CalendarEventList events={today} emptyLabel="Nada agendado para hoje." />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Próximos compromissos</CardTitle>
            <CardDescription>Pendentes nos próximos 7 dias (excluindo hoje).</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/agenda">Ver agenda completa</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <CalendarEventList events={upcoming7d} emptyLabel="Nenhum compromisso nos próximos 7 dias." />
        </CardContent>
      </Card>
    </div>
  );
}
