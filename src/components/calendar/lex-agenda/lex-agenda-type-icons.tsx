import { AlertTriangle, CalendarDays, List, Scale } from "lucide-react";
import type { ScheduleEventType } from "@/lib/calendar/schedule-shapes";

export const LEX_AGENDA_TYPE_STYLE: Record<
  ScheduleEventType,
  { chip: string; bar: string; icon: "scale" | "alert" | "users" | "bell" | "list" | "gavel" }
> = {
  audiencia: {
    chip: "border-l-[3px] border-l-rose-500 bg-rose-500/18 text-rose-950 dark:text-rose-50",
    bar: "bg-rose-500",
    icon: "gavel",
  },
  prazo: {
    chip: "border-l-[3px] border-l-amber-500 bg-amber-500/20 text-amber-950 dark:text-amber-50",
    bar: "bg-amber-500",
    icon: "alert",
  },
  reuniao: {
    chip: "border-l-[3px] border-l-violet-500 bg-violet-500/15 text-violet-950 dark:text-violet-50",
    bar: "bg-violet-500",
    icon: "users",
  },
  intimacao: {
    chip: "border-l-[3px] border-l-orange-500 bg-orange-500/18 text-orange-950 dark:text-orange-50",
    bar: "bg-orange-500",
    icon: "bell",
  },
  followup: {
    chip: "border-l-[3px] border-l-cyan-600 bg-cyan-500/12 text-cyan-950 dark:text-cyan-50",
    bar: "bg-cyan-600",
    icon: "list",
  },
  interno: {
    chip: "border-l-[3px] border-l-slate-500 bg-slate-500/12 text-slate-900 dark:text-slate-100",
    bar: "bg-slate-500",
    icon: "list",
  },
};

export function LexAgendaTypeIcon({ kind }: { kind: (typeof LEX_AGENDA_TYPE_STYLE)[ScheduleEventType]["icon"] }) {
  const cl = "size-3.5 shrink-0 opacity-90";
  if (kind === "gavel") return <Scale className={cl} aria-hidden />;
  if (kind === "alert") return <AlertTriangle className={cl} aria-hidden />;
  if (kind === "users") return <CalendarDays className={cl} aria-hidden />;
  if (kind === "bell") return <AlertTriangle className={cl} aria-hidden />;
  return <List className={cl} aria-hidden />;
}
