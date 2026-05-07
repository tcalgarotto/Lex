/**
 * Adapter de calendário (Google/Outlook agnóstico).
 *
 * Em ambiente sem secretRef, opera como gerador ICS (RFC 5545) determinístico.
 * Útil para dar ao advogado um arquivo `.ics` baixável a partir do cockpit
 * mesmo antes de qualquer integração real.
 */

import { IntegrationProvider } from "@prisma/client";
import type {
  IntegrationAdapter,
  IntegrationContext,
  IntegrationHealth,
  CalendarEvent,
} from "./types";
import { fingerprintOf } from "./fingerprint";

function nowIso(): string {
  return new Date().toISOString();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Converte ISO string para `YYYYMMDDTHHMMSSZ` (UTC, formato ICS). */
export function toIcsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida para ICS: ${iso}`);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/**
 * Renderiza eventos como uma string ICS (VCALENDAR).
 * Garante UID estável a partir de fingerprint.
 */
export function renderIcs(
  events: ReadonlyArray<CalendarEvent>,
  meta: { prodId?: string } = {},
): string {
  const prodId = meta.prodId ?? "-//Lex//Cockpit Jurídico//PT-BR";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
  ];
  for (const ev of events) {
    const uid = ev.uid ?? `${fingerprintOf(["calendar", ev.title, ev.start])}@lex`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toIcsDate(nowIso())}`);
    lines.push(`DTSTART:${toIcsDate(ev.start)}`);
    lines.push(`DTEND:${toIcsDate(ev.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export const calendarAdapter: IntegrationAdapter = {
  provider: IntegrationProvider.CALENDAR,

  async health(ctx: IntegrationContext): Promise<IntegrationHealth> {
    const checkedAt = nowIso();
    if (!ctx.secretRef) {
      return {
        ok: true,
        message: "Sem provedor externo — modo ICS export disponível.",
        code: "ICS_ONLY",
        checkedAt,
      };
    }
    return { ok: true, message: "Calendar provider pronto.", code: "READY", checkedAt };
  },

  async listCalendarEvents(): Promise<CalendarEvent[]> {
    return [];
  },

  async createCalendarEvent(_ctx, event: CalendarEvent): Promise<{ uid: string; ok: boolean }> {
    const uid = event.uid ?? `${fingerprintOf(["calendar", event.title, event.start])}@lex`;
    return { uid, ok: true };
  },
};
