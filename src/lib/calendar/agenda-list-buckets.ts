import type { ScheduleEventDto } from "@/lib/calendar/schedule-shapes";

export type AgendaListSection = { id: string; label: string; events: ScheduleEventDto[] };

function eventDateTime(e: ScheduleEventDto): Date {
  if (e.all_day) return new Date(`${e.date}T12:00:00`);
  return new Date(`${e.date}T${e.start}:00`);
}

/**
 * Agrupa eventos para a vista Lista: atrasados, hoje, amanhã, esta semana, depois.
 * `overdue` deve ser a lista já filtrada (ex.: PENDING com data/hora já passada).
 */
export function buildAgendaListSections(
  visible: ScheduleEventDto[],
  overdue: ScheduleEventDto[],
  todayKey: string,
  tomorrowKey: string,
  weekEndKey: string,
): AgendaListSection[] {
  const overdueIds = new Set(overdue.map((e) => e.id));
  const rest = visible.filter((e) => !overdueIds.has(e.id));

  const overdueSorted = [...overdue].sort((a, b) => eventDateTime(a).getTime() - eventDateTime(b).getTime());

  const today = rest.filter((e) => e.date === todayKey);
  const tomorrow = rest.filter((e) => e.date === tomorrowKey);
  const thisWeek = rest.filter((e) => e.date > tomorrowKey && e.date <= weekEndKey);
  const later = rest.filter((e) => e.date > weekEndKey);

  const sortByStart = (a: ScheduleEventDto, b: ScheduleEventDto) => {
    const dk = a.date.localeCompare(b.date);
    if (dk !== 0) return dk;
    return a.start.localeCompare(b.start);
  };

  today.sort(sortByStart);
  tomorrow.sort(sortByStart);
  thisWeek.sort(sortByStart);
  later.sort(sortByStart);

  const sections: AgendaListSection[] = [];
  if (overdueSorted.length > 0) sections.push({ id: "overdue", label: "Atrasados", events: overdueSorted });
  if (today.length > 0) sections.push({ id: "today", label: "Hoje", events: today });
  if (tomorrow.length > 0) sections.push({ id: "tomorrow", label: "Amanhã", events: tomorrow });
  if (thisWeek.length > 0) sections.push({ id: "this_week", label: "Esta semana", events: thisWeek });
  if (later.length > 0) sections.push({ id: "later", label: "Depois", events: later });
  return sections;
}
