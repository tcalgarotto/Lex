"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { normalizeTimeHm, readScheduleApiError } from "@/lib/calendar/schedule-client-helpers";
import { SCHEDULE_TYPE_LABEL } from "@/lib/calendar/schedule-event-present";
import type { ScheduleEventDto, ScheduleEventType } from "@/lib/calendar/schedule-shapes";
import { SCHEDULE_EVENT_TYPES } from "@/lib/calendar/schedule-shapes";

type MetaUser = { id: string; name: string | null; email: string };
type MetaCase = { id: string; title: string };
type MetaLegalProcess = { id: string; label: string; caso_id: string | null; caso_title: string | null };
type MetaInternalProcess = { id: string; label: string; number: string };

/** Valores iniciais ao abrir criar/editar — atualizados só quando `sessionKey` muda. */
export type LexAgendaEventFormSeed = {
  title: string;
  type: ScheduleEventType;
  date: string;
  start: string;
  end: string;
  all_day: boolean;
  local: string;
  obs: string;
  caso_id: string;
  responsavel_id: string;
  processo_id: string;
  legal_process_id: string;
  document_id: string;
};

export type LexAgendaEventDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  /** Incrementado ao cada abertura para reaplicar `seed` sem depender de identidade de objeto. */
  sessionKey: number;
  seed: LexAgendaEventFormSeed;
  editingEventId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (event: ScheduleEventDto, wasEdit: boolean) => void;
  onMarkDone?: (id: string) => Promise<boolean>;
  onMarkCancelled?: (id: string) => Promise<boolean>;
  cases: MetaCase[];
  users: MetaUser[];
  legalProcesses: MetaLegalProcess[];
  internalProcesses: MetaInternalProcess[];
  legalHint?: ReactNode;
};

export function LexAgendaEventDialog(props: LexAgendaEventDialogProps) {
  const {
    mode,
    open,
    sessionKey,
    seed,
    editingEventId,
    onOpenChange,
    onSaved,
    onMarkDone,
    onMarkCancelled,
    cases,
    users,
    legalProcesses,
    internalProcesses,
    legalHint,
  } = props;

  const [formTitle, setFormTitle] = useState(seed.title);
  const [formType, setFormType] = useState<ScheduleEventType>(seed.type);
  const [formDate, setFormDate] = useState(seed.date);
  const [formStart, setFormStart] = useState(seed.start);
  const [formEnd, setFormEnd] = useState(seed.end);
  const [formAllDay, setFormAllDay] = useState(seed.all_day);
  const [formLocal, setFormLocal] = useState(seed.local);
  const [formObs, setFormObs] = useState(seed.obs);
  const [formCaso, setFormCaso] = useState(seed.caso_id);
  const [formResp, setFormResp] = useState(seed.responsavel_id);
  const [formProcesso, setFormProcesso] = useState(seed.processo_id);
  const [formLegalProcess, setFormLegalProcess] = useState(seed.legal_process_id);
  const [formDocument, setFormDocument] = useState(seed.document_id);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormTitle(seed.title);
    setFormType(seed.type);
    setFormDate(seed.date);
    setFormStart(seed.start);
    setFormEnd(seed.end);
    setFormAllDay(seed.all_day);
    setFormLocal(seed.local);
    setFormObs(seed.obs);
    setFormCaso(seed.caso_id);
    setFormResp(seed.responsavel_id);
    setFormProcesso(seed.processo_id);
    setFormLegalProcess(seed.legal_process_id);
    setFormDocument(seed.document_id);
    setSubmitError(null);
  }, [open, sessionKey, seed]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      setSubmitError("Informe um título para o compromisso.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const startHm = formAllDay ? "00:00" : normalizeTimeHm(formStart);
      const endHmRaw = formEnd.trim();
      const payload = {
        title,
        type: formType,
        date: formDate,
        start: startHm,
        end: formAllDay ? null : endHmRaw ? normalizeTimeHm(endHmRaw) : null,
        all_day: formAllDay,
        local: formLocal.trim() || null,
        obs: formObs.trim() || null,
        caso_id: formCaso.trim() || null,
        responsavel_id: formResp.trim() || null,
        processo_id: formProcesso.trim() || null,
        legal_process_id: formLegalProcess.trim() || null,
        document_id: formDocument.trim() || null,
      };
      if (editingEventId) {
        const res = await fetch(`/api/schedule/events/${editingEventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readScheduleApiError(res));
        const j = (await res.json()) as { event: ScheduleEventDto };
        onSaved(j.event, true);
      } else {
        const res = await fetch("/api/schedule/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readScheduleApiError(res));
        const j = (await res.json()) as { event: ScheduleEventDto };
        onSaved(j.event, false);
      }
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkDone() {
    if (!editingEventId || !onMarkDone) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const ok = await onMarkDone(editingEventId);
      if (ok) onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCancelled() {
    if (!editingEventId || !onMarkCancelled) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const ok = await onMarkCancelled(editingEventId);
      if (ok) onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          "flex w-[min(100vw-1rem,24rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-md",
          "max-h-[min(90vh,700px)] max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl",
          "!border-[color:var(--border-subtle)] !bg-[color:var(--surface-card)] shadow-xl [background-image:none] !backdrop-blur-none",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 pb-3 pt-4 text-left">
          <DialogTitle className="text-lg font-semibold">{mode === "edit" ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
          <p className="text-sm font-normal text-muted-foreground">
            {mode === "edit"
              ? "Altere os dados e salve. Controle interno do JustOS — confirme prazos oficiais no tribunal."
              : "Preencha os dados. Campos opcionais ampliam o contexto jurídico."}
          </p>
        </DialogHeader>

        {submitError ? (
          <div
            role="alert"
            className="shrink-0 border-b border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-900 dark:text-rose-50"
          >
            {submitError}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[color:var(--surface-card)] px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="lex-agenda-ft">Título</Label>
              <Input id="lex-agenda-ft" className="!bg-[color:var(--surface-elevated)] text-base" value={formTitle} onChange={(ev) => setFormTitle(ev.target.value)} required maxLength={500} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lex-agenda-fty">Tipo</Label>
              <select
                id="lex-agenda-fty"
                className="flex h-11 w-full rounded-md border border-input bg-[color:var(--surface-elevated)] px-3 text-base"
                value={formType}
                onChange={(ev) => setFormType(ev.target.value as ScheduleEventType)}
              >
                {SCHEDULE_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SCHEDULE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-[color:var(--text-primary)]">
              <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} className="size-4 rounded border-input" />
              Dia inteiro
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="lex-agenda-fd">Data</Label>
                <Input id="lex-agenda-fd" className="!bg-[color:var(--surface-elevated)] text-base" type="date" value={formDate} onChange={(ev) => setFormDate(ev.target.value)} required />
              </div>
              {!formAllDay ? (
                <div className="space-y-1">
                  <Label htmlFor="lex-agenda-fs">Início</Label>
                  <Input id="lex-agenda-fs" className="!bg-[color:var(--surface-elevated)] text-base" type="time" value={formStart} onChange={(ev) => setFormStart(ev.target.value)} required />
                </div>
              ) : (
                <div />
              )}
            </div>
            {!formAllDay ? (
              <div className="space-y-1">
                <Label htmlFor="lex-agenda-fe">Fim (opcional)</Label>
                <Input id="lex-agenda-fe" className="!bg-[color:var(--surface-elevated)] text-base" type="time" value={formEnd} onChange={(ev) => setFormEnd(ev.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="lex-agenda-fl">Local</Label>
              <Input id="lex-agenda-fl" className="!bg-[color:var(--surface-elevated)] text-base" value={formLocal} onChange={(ev) => setFormLocal(ev.target.value)} maxLength={500} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lex-agenda-fo">Descrição</Label>
              <Input id="lex-agenda-fo" className="!bg-[color:var(--surface-elevated)] text-base" value={formObs} onChange={(ev) => setFormObs(ev.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Caso</Label>
              <select className="flex h-11 w-full rounded-md border border-input bg-[color:var(--surface-elevated)] px-3 text-base" value={formCaso} onChange={(ev) => setFormCaso(ev.target.value)}>
                <option value="">—</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <select className="flex h-11 w-full rounded-md border border-input bg-[color:var(--surface-elevated)] px-3 text-base" value={formResp} onChange={(ev) => setFormResp(ev.target.value)}>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name?.trim() || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Processo interno</Label>
              <select className="flex h-11 w-full rounded-md border border-input bg-[color:var(--surface-elevated)] px-3 text-base" value={formProcesso} onChange={(ev) => setFormProcesso(ev.target.value)}>
                <option value="">—</option>
                {internalProcesses.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Processo judicial (CNJ)</Label>
              <select className="flex h-11 w-full rounded-md border border-input bg-[color:var(--surface-elevated)] px-3 text-base" value={formLegalProcess} onChange={(ev) => setFormLegalProcess(ev.target.value)}>
                <option value="">—</option>
                {legalProcesses.map((lp) => (
                  <option key={lp.id} value={lp.id}>
                    {lp.label}
                    {lp.caso_title ? ` · ${lp.caso_title}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lex-agenda-doc">Documento (ID interno, opcional)</Label>
              <Input
                id="lex-agenda-doc"
                className="!bg-[color:var(--surface-elevated)] text-base font-mono"
                value={formDocument}
                onChange={(ev) => setFormDocument(ev.target.value)}
                placeholder="Opcional"
                autoComplete="off"
              />
            </div>
            {legalHint ?? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Controle interno do JustOS. Para prazos e comunicações oficiais, confirme sempre no portal do tribunal ou DJE.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3">
            {mode === "edit" && (onMarkDone || onMarkCancelled) ? (
              <div className="flex flex-wrap gap-2">
                {onMarkDone ? (
                  <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleMarkDone()}>
                    Concluir
                  </Button>
                ) : null}
                {onMarkCancelled ? (
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void handleMarkCancelled()} className="text-rose-700 hover:text-rose-800">
                    Cancelar compromisso
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
