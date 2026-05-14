import { CALENDAR_DISPLAY_TIMEZONE } from "@/lib/calendar/calendar-labels";

/** Hora e minuto do instante `d` no fuso da agenda (exibição). */
export function hourMinuteInAgendaTz(d: Date): { hour: number; minute: number } {
  const tz = CALENDAR_DISPLAY_TIMEZONE;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const parts = f.formatToParts(d);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = Number(p.value);
    if (p.type === "minute") minute = Number(p.value);
  }
  return { hour, minute };
}
