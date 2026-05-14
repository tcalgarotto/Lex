"use client";

import Link from "next/link";
import { Check, FileText, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agendaScheduleEventOverdue } from "@/components/calendar/lex-agenda/lex-agenda-event-datetime";
import { LEX_AGENDA_TYPE_STYLE, LexAgendaTypeIcon } from "@/components/calendar/lex-agenda/lex-agenda-type-icons";
import { SCHEDULE_TYPE_LABEL } from "@/lib/calendar/schedule-event-present";
import type { ScheduleEventDto } from "@/lib/calendar/schedule-shapes";

export function LexAgendaEventRow({
  e,
  onDone,
  onCancel,
  onEdit,
  layout = "default",
}: {
  e: ScheduleEventDto;
  onDone: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  layout?: "default" | "day-focus";
}) {
  const overdue = agendaScheduleEventOverdue(e);
  const dayFocus = layout === "day-focus";
  return (
    <div className="group relative space-y-1">
      {dayFocus && e.status === "PENDING" && onCancel ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-0.5 top-0.5 z-10 size-6 rounded-md opacity-0 transition-opacity hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
          onClick={(ev) => {
            ev.stopPropagation();
            onCancel();
          }}
          aria-label="Cancelar compromisso"
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className={cn("min-w-0 flex-1", dayFocus && e.status === "PENDING" && onCancel && "pr-7")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {overdue ? (
              <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-200">
                Atrasado
              </span>
            ) : null}
            {e.requires_human_review ? (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                Revisão
              </span>
            ) : null}
            <span className="rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-1.5 py-px text-[10px] font-semibold uppercase text-muted-foreground">
              {e.status === "PENDING" ? "Pendente" : e.status === "DONE" ? "Concluído" : "Cancelado"}
            </span>
          </div>
          <p className={cn("mt-0.5 font-semibold leading-snug", e.status === "DONE" && "line-through opacity-60")}>{e.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LexAgendaTypeIcon kind={LEX_AGENDA_TYPE_STYLE[e.type].icon} />
            </span>
            <span className="tabular-nums">{e.date}</span>
            <span>{e.all_day ? "Dia inteiro" : e.start}</span>
            {e.end ? <span>–{e.end}</span> : null}
            <span>· {SCHEDULE_TYPE_LABEL[e.type]}</span>
            {e.status === "CANCELLED" ? <span className="text-muted-foreground">· Cancelado</span> : null}
          </p>
          {e.caso_title ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Caso: {e.caso_title}
              {e.caso_id ? (
                <Link href={`/cases/${e.caso_id}`} className="ml-1 text-violet-600 underline">
                  Abrir caso
                </Link>
              ) : null}
            </p>
          ) : null}
          {e.process_label ? <p className="truncate text-xs text-muted-foreground">{e.process_label}</p> : null}
          {e.cnj ? <p className="truncate text-xs font-mono text-muted-foreground">{e.cnj}</p> : null}
          {e.responsavel_label ? <p className="text-xs text-muted-foreground">Resp.: {e.responsavel_label}</p> : null}
          {e.local ? <p className="text-xs">Local: {e.local}</p> : null}
          {e.obs ? <p className="line-clamp-3 text-xs text-muted-foreground">{e.obs}</p> : null}
        </div>
        {!dayFocus ? (
          <div className="flex shrink-0 flex-col gap-1">
            {onEdit ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1 px-2"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
            ) : null}
            {e.status === "PENDING" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 px-2"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDone();
                }}
              >
                <Check className="size-3.5" />
                Concluir
              </Button>
            ) : null}
            {e.status === "PENDING" && onCancel ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-rose-600"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onCancel();
                }}
              >
                Cancelar compromisso
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {dayFocus ? (
        <div className="mt-2 border-t border-[color:var(--border-subtle)] pt-2">
          <div className={cn("grid gap-2", e.status === "PENDING" ? "grid-cols-2" : "grid-cols-1")}>
          {onEdit ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 w-full gap-1 px-2"
              onClick={(ev) => {
                ev.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="size-3.5" />
              Editar
            </Button>
          ) : null}
          {e.status === "PENDING" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full gap-1 px-2"
              onClick={(ev) => {
                ev.stopPropagation();
                onDone();
              }}
            >
              <Check className="size-3.5" />
              Concluir
            </Button>
          ) : null}
          </div>
        </div>
      ) : null}
      {!dayFocus ? <div className="flex flex-wrap gap-2 pt-1">
        {e.legal_process_id ? (
          <Button type="button" variant="secondary" size="sm" className="h-8 px-2 text-xs" asChild>
            <Link href={`/processos/${e.legal_process_id}`}>Processo judicial</Link>
          </Button>
        ) : null}
        {e.processo_id ? (
          <Button type="button" variant="secondary" size="sm" className="h-8 px-2 text-xs" asChild>
            <Link href={`/processos/${e.processo_id}`}>Abrir processo</Link>
          </Button>
        ) : null}
        {e.document_id ? (
          <Button type="button" variant="secondary" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
            <Link href={`/biblioteca/documentos/${e.document_id}`}>
              <FileText className="size-3.5 shrink-0" />
              Abrir documento
            </Link>
          </Button>
        ) : null}
        {e.caso_id ? (
          <Button type="button" variant="secondary" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
            <Link href={`/cases/${e.caso_id}/documentos`}>Documentos do caso</Link>
          </Button>
        ) : null}
      </div> : null}
    </div>
  );
}
