"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarEventType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CALENDAR_EVENT_TYPE_LABEL_PT } from "@/lib/calendar/calendar-labels";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const EVENT_TYPES = Object.keys(CALENDAR_EVENT_TYPE_LABEL_PT) as CalendarEventType[];

export function NewCalendarEventDialog({
  members,
  caseId,
  processId,
  legalProcessId,
  documentId,
  label = "Novo evento",
  defaultStartsAtLocal,
  triggerClassName,
}: {
  members: { id: string; name: string | null; email: string }[];
  caseId?: string;
  processId?: string;
  legalProcessId?: string;
  documentId?: string;
  label?: string;
  /** Valor `datetime-local` ao abrir o diálogo (ex.: slot da grade). */
  defaultStartsAtLocal?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>(CalendarEventType.OTHER);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");

  function applyDefaultStart() {
    if (defaultStartsAtLocal) {
      setStartsAt(defaultStartsAtLocal);
      return;
    }
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    setStartsAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) applyDefaultStart();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          eventType,
          startsAt: new Date(startsAt).toISOString(),
          caseId: caseId ?? null,
          processId: processId ?? null,
          legalProcessId: legalProcessId ?? null,
          documentId: documentId ?? null,
          assignedToUserId: assignedToUserId || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      setOpen(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={triggerClassName ? "outline" : "secondary"}
          className={cn(triggerClassName)}
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo evento na agenda</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="cal-title">Título</Label>
            <Input
              id="cal-title"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              required
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-type">Tipo</Label>
            <select
              id="cal-type"
              className={selectClassName}
              value={eventType}
              onChange={(ev) => setEventType(ev.target.value as CalendarEventType)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CALENDAR_EVENT_TYPE_LABEL_PT[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-start">Início (data e hora local)</Label>
            <Input
              id="cal-start"
              type="datetime-local"
              value={startsAt}
              onChange={(ev) => setStartsAt(ev.target.value)}
              required
            />
            <p className="text-sm text-muted-foreground">
              O servidor grava em ISO UTC; o fuso padrão do evento é America/Sao_Paulo.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-assign">Responsável (opcional)</Label>
            <select
              id="cal-assign"
              className={selectClassName}
              value={assignedToUserId || ""}
              onChange={(ev) => setAssignedToUserId(ev.target.value)}
            >
              <option value="">Não atribuir</option>
              {members.map((mem) => (
                <option key={mem.id} value={mem.id}>
                  {mem.name?.trim() || mem.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-desc">Descrição (opcional)</Label>
            <Textarea id="cal-desc" value={description} onChange={(ev) => setDescription(ev.target.value)} rows={3} />
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "A guardar…" : "Criar evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
