"use client";

import { memo } from "react";
import { format, getISODay, isSameMonth, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LEX_AGENDA_GRID_LINE_H_HEADER,
  LEX_AGENDA_GRID_LINE_H_SOFT,
  LEX_AGENDA_GRID_LINE_L,
  LEX_AGENDA_GRID_LINE_R,
  LEX_AGENDA_GRID_LINE_T,
  LEX_AGENDA_MONTH_WEEK_HDR,
} from "@/components/calendar/lex-agenda/lex-agenda-grid-constants";
import { LEX_AGENDA_TYPE_STYLE, LexAgendaTypeIcon } from "@/components/calendar/lex-agenda/lex-agenda-type-icons";
import { SCHEDULE_TYPE_LABEL } from "@/lib/calendar/schedule-event-present";
import type { ScheduleEventDto, ScheduleEventType } from "@/lib/calendar/schedule-shapes";

export type LexAgendaMonthGridProps = {
  monthGridDays: Date[];
  monthAnchor: Date;
  eventsByDate: Map<string, ScheduleEventDto[]>;
  selectedKey: string;
  initialFetchDone: boolean;
  visibleEventsLength: number;
  agendaDayKey: string;
  onMonthCellPick: (d: Date) => void;
  openCreate: (dateKey: string, startHm?: string, preset?: { type?: ScheduleEventType; title?: string }) => void;
  openEdit: (e: ScheduleEventDto) => void;
  onMoveEvent: (e: ScheduleEventDto, targetDateKey: string) => void;
};

function LexAgendaMonthGridInner(props: LexAgendaMonthGridProps) {
  const {
    monthGridDays,
    monthAnchor,
    eventsByDate,
    selectedKey,
    initialFetchDone,
    visibleEventsLength,
    agendaDayKey,
    onMonthCellPick,
    openCreate,
    openEdit,
    onMoveEvent,
  } = props;

  const lastRow = Math.floor((monthGridDays.length - 1) / 7);

  return (
    <div className="flex min-h-[min(70vh,640px)] w-full min-w-0 flex-col gap-3 py-2 md:py-3">
      <div className="lex-agenda-month-grid-frame grid min-h-0 flex-1 grid-cols-7 gap-0 bg-[color:var(--surface-card)]">
        {LEX_AGENDA_MONTH_WEEK_HDR.map((w, i) => (
          <div
            key={w}
            className={cn(
              "bg-[color:var(--surface-card)] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
              LEX_AGENDA_GRID_LINE_L,
              LEX_AGENDA_GRID_LINE_T,
              LEX_AGENDA_GRID_LINE_H_HEADER,
              i === 6 && LEX_AGENDA_GRID_LINE_R,
            )}
          >
            {w}
          </div>
        ))}
        {monthGridDays.map((d, idx) => {
          const col = idx % 7;
          const row = Math.floor(idx / 7);
          const key = format(d, "yyyy-MM-dd");
          const inM = isSameMonth(d, monthAnchor);
          const iso = getISODay(d);
          const wend = iso === 6 || iso === 7;
          const list = eventsByDate.get(key) ?? [];
          const sel = key === selectedKey;
          const td = isToday(d);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onMonthCellPick(d);
                openCreate(key);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onMonthCellPick(d);
                openCreate(key);
              }}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                const raw = ev.dataTransfer.getData("application/x-lex-month-event");
                if (!raw) return;
                try {
                  const parsed = JSON.parse(raw) as { id: string };
                  let found: ScheduleEventDto | undefined;
                  for (const bucket of eventsByDate.values()) {
                    const hit = bucket.find((x) => x.id === parsed.id);
                    if (hit) {
                      found = hit;
                      break;
                    }
                  }
                  if (!found) return;
                  onMoveEvent(found, key);
                } catch {
                  /* ignore malformed payload */
                }
              }}
              className={cn(
                "group flex min-h-[5.5rem] flex-col items-stretch gap-0 rounded-none border-0 bg-[color:var(--surface-card)] p-1 text-left text-xs outline-none ring-0 ring-offset-0 transition-colors hover:bg-[color:var(--surface-elevated)] focus-visible:ring-1 focus-visible:ring-violet-500/55 focus-visible:ring-offset-0 md:min-h-[7.5rem] lg:min-h-[8.5rem]",
                LEX_AGENDA_GRID_LINE_L,
                row > 0 && LEX_AGENDA_GRID_LINE_T,
                col === 6 && LEX_AGENDA_GRID_LINE_R,
                row === lastRow && LEX_AGENDA_GRID_LINE_H_SOFT,
                !inM && "bg-[color:var(--surface-base)] text-muted-foreground/75 dark:bg-[color:var(--surface-base)]",
                wend && inM && "bg-violet-500/[0.045] dark:bg-violet-400/[0.07]",
                td && inM && !sel && "bg-violet-500/10 dark:bg-violet-500/14",
                sel && "z-[1] bg-violet-500/[0.08] ring-1 ring-inset ring-violet-500/25 dark:bg-violet-500/12",
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                    !inM && "text-muted-foreground/65",
                    inM && !td && !sel && "text-[color:var(--text-primary)] group-hover:bg-[color:var(--surface-elevated)]",
                    td && !sel && "bg-violet-500/20 text-violet-800 ring-1 ring-violet-400/30 dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-400/25",
                    sel && "bg-violet-600 text-white shadow-sm ring-0 dark:bg-violet-600",
                  )}
                >
                  {format(d, "d")}
                </span>
                {list.length > 0 ? (
                  <span className="rounded-full bg-[color:var(--surface-elevated)] px-1.5 py-px text-[10px] font-medium text-muted-foreground">{list.length}</span>
                ) : null}
              </span>
              <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
                {list.length === 0 ? (
                  <span className="mt-1 text-[10px] text-muted-foreground/80 opacity-0 transition-opacity group-hover:opacity-100">Clique para criar</span>
                ) : null}
                {list.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    className={cn(
                      "flex min-h-0 cursor-pointer items-center gap-0.5 truncate rounded-md border border-transparent px-1 py-0.5 text-[10px] leading-tight hover:border-[color:var(--border-subtle)]",
                      LEX_AGENDA_TYPE_STYLE[e.type].chip,
                      e.status === "DONE" && "opacity-50 line-through",
                      e.status === "CANCELLED" && "opacity-40 grayscale",
                    )}
                    title={`${e.start} · ${SCHEDULE_TYPE_LABEL[e.type]} · ${e.title}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onMonthCellPick(d);
                      openEdit(e);
                    }}
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData("application/x-lex-month-event", JSON.stringify({ id: e.id }));
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onMonthCellPick(d);
                        openEdit(e);
                      }
                    }}
                  >
                    <LexAgendaTypeIcon kind={LEX_AGENDA_TYPE_STYLE[e.type].icon} />
                    {!e.all_day ? <span className="shrink-0 tabular-nums opacity-80">{e.start}</span> : null}
                    <span className="min-w-0 truncate font-medium">{e.title}</span>
                  </div>
                ))}
                {list.length > 3 ? <span className="text-[10px] font-medium text-cyan-700 dark:text-cyan-300">+{list.length - 3} mais</span> : null}
              </div>
            </button>
          );
        })}
      </div>
      {initialFetchDone && visibleEventsLength === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/40 p-4 text-center">
          <p className="text-sm font-semibold">Nenhum compromisso neste mês</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie pela grelha, pelo botão Novo ou ligue a um caso.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => openCreate(agendaDayKey)}>
              Novo compromisso
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const LexAgendaMonthGrid = memo(LexAgendaMonthGridInner);
