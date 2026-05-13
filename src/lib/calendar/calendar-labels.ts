import type {
  CalendarEventSource,
  CalendarEventStatus,
  CalendarEventType,
} from "@prisma/client";

/** Fuso usado para agrupar "hoje" / mês na UI (P1). */
export const CALENDAR_DISPLAY_TIMEZONE = "America/Sao_Paulo" as const;

export const CALENDAR_EVENT_TYPE_LABEL_PT: Record<CalendarEventType, string> = {
  CLIENT_MEETING: "Reunião com cliente",
  HEARING: "Audiência",
  REVIEW_DEADLINE: "Prazo de revisão",
  REVIEW_COMMUNICATION: "Revisar comunicação ou intimação",
  FOLLOW_UP: "Follow-up",
  INTERNAL_TASK: "Tarefa interna",
  OTHER: "Outro",
};

export const CALENDAR_EVENT_STATUS_LABEL_PT: Record<CalendarEventStatus, string> = {
  PENDING: "Pendente",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
};

export const CALENDAR_EVENT_SOURCE_LABEL_PT: Record<CalendarEventSource, string> = {
  MANUAL: "Manual",
  OFFICIAL_COMMUNICATION: "Comunicação oficial",
  OTHER: "Outro",
};

/** Chave `YYYY-MM-DD` no fuso indicado (para comparações de dia). */
export function calendarDateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
