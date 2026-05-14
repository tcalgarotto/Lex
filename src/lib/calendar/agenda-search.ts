import type { CalendarEventWithRelations } from "@/lib/calendar/calendar-queries";

export function agendaMatchesSearch(e: CalendarEventWithRelations, q: string | undefined): boolean {
  const t = q?.trim().toLowerCase();
  if (!t) return true;
  if (e.title.toLowerCase().includes(t)) return true;
  if (e.description?.toLowerCase().includes(t)) return true;
  if (e.case?.title?.toLowerCase().includes(t)) return true;
  if (e.process?.title?.toLowerCase().includes(t)) return true;
  if (e.process?.number?.toLowerCase().includes(t)) return true;
  if (e.assignedTo?.name?.toLowerCase().includes(t)) return true;
  if (e.assignedTo?.email?.toLowerCase().includes(t)) return true;
  return false;
}

export function agendaFilterEvents<T extends CalendarEventWithRelations>(events: T[], q: string | undefined): T[] {
  return events.filter((e) => agendaMatchesSearch(e, q));
}
