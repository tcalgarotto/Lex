import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { calendarDateKeyInTimeZone, CALENDAR_DISPLAY_TIMEZONE } from "@/lib/calendar/calendar-labels";

export type AgendaView = "month" | "week" | "day";

export type AgendaUrlState = {
  view: AgendaView;
  /** `yyyy-MM` — mês exibido na vista mês e no mini-calendário. */
  month: string;
  /** `yyyy-MM-dd` — âncora (dia ativo, semana que o contém, etc.). */
  date: string;
  caseId?: string;
  processId?: string;
  assignedToUserId?: string;
  eventType?: string;
  /** Busca em título/descrição (filtro em memória na página). */
  q?: string;
  /** ID do evento para painel de detalhe. */
  event?: string;
};

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayDateKey(): string {
  return calendarDateKeyInTimeZone(new Date(), CALENDAR_DISPLAY_TIMEZONE);
}

export function dateKeyFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function monthKeyFromDate(d: Date): string {
  return format(d, "yyyy-MM");
}

/** Interpreta `yyyy-MM-dd` como data de calendário local (mesmo critério do restante da agenda). */
export function parseLocalDateKey(key: string): Date | null {
  if (!DATE_RE.test(key)) return null;
  const parts = key.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function parseAgendaUrlState(sp: {
  view?: string;
  month?: string;
  date?: string;
  caseId?: string;
  processId?: string;
  assignedToUserId?: string;
  eventType?: string;
  q?: string;
  event?: string;
}): AgendaUrlState {
  const today = todayDateKey();
  const view: AgendaView =
    sp.view === "week" || sp.view === "day" || sp.view === "month" ? sp.view : "month";

  let date = sp.date?.trim();
  if (!date || !DATE_RE.test(date)) date = today;
  const anchor = parseLocalDateKey(date);
  if (!anchor) date = today;

  let month = sp.month?.trim();
  if (!month || !MONTH_RE.test(month)) {
    const ad = parseLocalDateKey(date) ?? new Date();
    month = monthKeyFromDate(ad);
  }

  return {
    view,
    month,
    date,
    caseId: sp.caseId?.trim() || undefined,
    processId: sp.processId?.trim() || undefined,
    assignedToUserId: sp.assignedToUserId?.trim() || undefined,
    eventType: sp.eventType?.trim() || undefined,
    q: sp.q?.trim() || undefined,
    event: sp.event?.trim() || undefined,
  };
}

export function buildAgendaHref(base: AgendaUrlState, patch: Partial<AgendaUrlState>): string {
  const next: AgendaUrlState = { ...base, ...patch };
  const p = new URLSearchParams();
  p.set("view", next.view);
  p.set("month", next.month);
  p.set("date", next.date);
  if (next.caseId) p.set("caseId", next.caseId);
  if (next.processId) p.set("processId", next.processId);
  if (next.assignedToUserId) p.set("assignedToUserId", next.assignedToUserId);
  if (next.eventType) p.set("eventType", next.eventType);
  if (next.q) p.set("q", next.q);
  if (next.event) p.set("event", next.event);
  const qs = p.toString();
  return qs ? `/agenda?${qs}` : "/agenda";
}

export function agendaMonthAnchor(monthStr: string): Date {
  if (!MONTH_RE.test(monthStr)) return new Date();
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return new Date();
  return new Date(y, m - 1, 15);
}

export function agendaRangeForView(
  view: AgendaView,
  monthStr: string,
  dateStr: string,
): { from: Date; to: Date } {
  const anchor = parseLocalDateKey(dateStr) ?? new Date();

  if (view === "day") {
    const from = startOfDayLocal(anchor);
    const to = endOfDayLocal(anchor);
    return { from, to };
  }

  if (view === "week") {
    const ws = startOfWeek(anchor, { weekStartsOn: 1 });
    const we = endOfWeek(anchor, { weekStartsOn: 1 });
    return { from: startOfDayLocal(ws), to: endOfDayLocal(we) };
  }

  const monthAnchor = agendaMonthAnchor(monthStr);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);
  return { from: startOfDayLocal(monthStart), to: endOfDayLocal(monthEnd) };
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function monthGridDays(monthStr: string): { days: Date[]; anchorMonth: Date } {
  const anchor = agendaMonthAnchor(monthStr);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return {
    days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
    anchorMonth: anchor,
  };
}

export function weekDaysForAnchor(dateStr: string): Date[] {
  const anchor = parseLocalDateKey(dateStr) ?? new Date();
  const ws = startOfWeek(anchor, { weekStartsOn: 1 });
  const we = endOfWeek(anchor, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: ws, end: we });
}

export function navigateDate(state: AgendaUrlState, delta: -1 | 1): AgendaUrlState {
  const anchor = parseLocalDateKey(state.date) ?? new Date();
  if (state.view === "day") {
    const next = addDays(anchor, delta);
    const dk = dateKeyFromDate(next);
    return { ...state, date: dk, month: monthKeyFromDate(next) };
  }
  if (state.view === "week") {
    const next = addDays(anchor, delta * 7);
    const dk = dateKeyFromDate(next);
    return { ...state, date: dk, month: monthKeyFromDate(next) };
  }
  const parts = state.month.split("-");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    const fb = new Date();
    return { ...state, month: monthKeyFromDate(fb), date: dateKeyFromDate(fb) };
  }
  const monthAnchor = new Date(y, mo - 1, 15);
  const nextM = addMonths(monthAnchor, delta);
  const mk = monthKeyFromDate(nextM);
  const dk = dateKeyFromDate(startOfMonth(nextM));
  return { ...state, month: mk, date: dk };
}

export function formatToolbarTitle(state: AgendaUrlState): string {
  const anchor = parseLocalDateKey(state.date) ?? new Date();
  if (state.view === "day") {
    return format(anchor, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  }
  if (state.view === "week") {
    const days = weekDaysForAnchor(state.date);
    const a = days[0]!;
    const b = days[6]!;
    if (a.getMonth() === b.getMonth()) {
      return `${format(a, "d", { locale: ptBR })}–${format(b, "d 'de' MMMM yyyy", { locale: ptBR })}`;
    }
    return `${format(a, "d MMM", { locale: ptBR })} – ${format(b, "d MMM yyyy", { locale: ptBR })}`;
  }
  return format(agendaMonthAnchor(state.month), "MMMM yyyy", { locale: ptBR });
}
