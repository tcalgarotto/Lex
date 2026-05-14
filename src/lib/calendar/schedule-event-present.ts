import type { CalendarEventSource } from "@prisma/client";
import type { ScheduleEventDto, ScheduleEventType } from "@/lib/calendar/schedule-shapes";

export const SCHEDULE_PORTAL_DISCLAIMER =
  "Revise no portal oficial. Este registo é controlo interno do Lex e não substitui prazo processual nem prova ciência em juízo.";

/** Labels orientados a produto jurídico (não copiar Google literalmente). */
export const SCHEDULE_TYPE_LABEL: Record<ScheduleEventType, string> = {
  audiencia: "Audiência",
  prazo: "Revisão de prazo",
  reuniao: "Reunião com cliente",
  intimacao: "Comunicação para revisar",
  followup: "Follow-up",
  interno: "Tarefa interna",
};

export function scheduleSourceLabelPt(source: CalendarEventSource): string {
  switch (source) {
    case "OFFICIAL_COMMUNICATION":
      return "Fonte oficial";
    case "MANUAL":
      return "Manual";
    default:
      return "Outro";
  }
}

export function scheduleNeedsPortalDisclaimer(dto: Pick<ScheduleEventDto, "type" | "source" | "requires_human_review">): boolean {
  if (dto.type === "prazo" || dto.type === "intimacao") return true;
  if (dto.requires_human_review || dto.source === "OFFICIAL_COMMUNICATION") return true;
  return false;
}
