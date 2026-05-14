import { z } from "zod";
import { SCHEDULE_EVENT_TYPES } from "@/lib/calendar/schedule-shapes";

/** Corpo aceito por `POST /api/schedule/events` (nomes alinhados ao frontend da agenda). */
export const scheduleEventPostSchema = z.object({
  title: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1).max(500)),
  caso_id: z.string().nullable().optional(),
  responsavel_id: z.string().nullable().optional(),
  processo_id: z.string().nullable().optional(),
  legal_process_id: z.string().nullable().optional(),
  document_id: z.string().nullable().optional(),
  type: z.enum(SCHEDULE_EVENT_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  local: z.string().max(500).nullable().optional(),
  obs: z.string().max(20000).nullable().optional(),
  all_day: z.boolean().optional(),
});

export type ScheduleEventPostBody = z.infer<typeof scheduleEventPostSchema>;
