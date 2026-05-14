import Link from "next/link";
import type { ReactNode } from "react";
import { NewCalendarEventDialog } from "@/components/calendar/new-calendar-event-dialog";
import { AgendaMiniMonth } from "@/components/calendar/agenda-mini-month";
import type { AgendaUrlState } from "@/lib/calendar/agenda-url-state";
import { cn } from "@/lib/utils";

export function AgendaSidebar({
  urlState,
  todayKey,
  members,
  caseId,
  processId,
  legalProcessId,
  defaultStartsAtLocal,
  children,
}: {
  urlState: AgendaUrlState;
  todayKey: string;
  members: { id: string; name: string | null; email: string }[];
  caseId?: string;
  processId?: string;
  legalProcessId?: string;
  defaultStartsAtLocal?: string;
  children: ReactNode;
}) {
  return (
    <aside className="flex w-full flex-col gap-4 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/40 p-4 lg:w-[280px] lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Agenda jurídica</p>
        <p className="text-sm text-muted-foreground">Compromissos do workspace (sem Google Calendar).</p>
      </div>
      <NewCalendarEventDialog
        members={members}
        label="Criar evento"
        caseId={caseId}
        processId={processId}
        legalProcessId={legalProcessId}
        defaultStartsAtLocal={defaultStartsAtLocal}
        triggerClassName="w-full justify-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-semibold shadow-sm hover:bg-[color:var(--surface-overlay)]"
      />
      <AgendaMiniMonth monthStr={urlState.month} urlState={urlState} todayKey={todayKey} />
      <div className="space-y-3 border-t border-[color:var(--border-subtle)] pt-4">{children}</div>
    </aside>
  );
}

export function AgendaFilterChip({
  active,
  href,
  children,
  title,
}: {
  active: boolean;
  href: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-violet-500/60 bg-violet-500/10 text-[color:var(--text-primary)]" : "border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-overlay)]",
      )}
    >
      {children}
    </Link>
  );
}

export function AgendaFilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
