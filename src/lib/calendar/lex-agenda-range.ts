import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type LexAgendaView = "month" | "week" | "day" | "list";

export function parseDateKeyLocal(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const parts = dateKey.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Intervalo UTC a pedir à API para cobrir a vista atual (grade de mês inclui semanas parciais).
 */
export function scheduleRangeForView(view: LexAgendaView, anchor: Date): { from: Date; to: Date } {
  switch (view) {
    case "month": {
      const ms = startOfMonth(anchor);
      const me = endOfMonth(anchor);
      // Grade mensal no estilo calendário comum no BR: semana começa no domingo.
      return {
        from: startOfWeek(ms, { weekStartsOn: 0 }),
        to: endOfWeek(me, { weekStartsOn: 0 }),
      };
    }
    case "week": {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case "day":
      return { from: startOfDay(anchor), to: endOfDay(anchor) };
    case "list":
    default:
      return { from: startOfDay(anchor), to: endOfDay(addDays(anchor, 45)) };
  }
}

export function weekDaysMondayStart(anchor: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  });
}
