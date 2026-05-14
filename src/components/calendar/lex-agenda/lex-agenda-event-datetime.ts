import type { ScheduleEventDto } from "@/lib/calendar/schedule-shapes";

export function agendaEventDateTime(e: ScheduleEventDto): Date {
  if (e.all_day) return new Date(`${e.date}T12:00:00`);
  return new Date(`${e.date}T${e.start}:00`);
}

export function agendaScheduleEventOverdue(e: ScheduleEventDto): boolean {
  if (e.status !== "PENDING") return false;
  return agendaEventDateTime(e).getTime() < Date.now();
}
