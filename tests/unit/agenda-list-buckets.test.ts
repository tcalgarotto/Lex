import { describe, expect, it } from "vitest";
import { CalendarEventSource, CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { buildAgendaListSections } from "@/lib/calendar/agenda-list-buckets";
import type { ScheduleEventDto } from "@/lib/calendar/schedule-shapes";

function evt(partial: Partial<ScheduleEventDto> & Pick<ScheduleEventDto, "id" | "date" | "start">): ScheduleEventDto {
  return {
    title: "T",
    caso_id: null,
    caso_title: null,
    processo_id: null,
    legal_process_id: null,
    document_id: null,
    cnj: null,
    process_label: null,
    responsavel_id: null,
    responsavel_label: null,
    type: "interno",
    prisma_event_type: CalendarEventType.INTERNAL_TASK,
    status: CalendarEventStatus.PENDING,
    all_day: false,
    end: null,
    local: null,
    obs: null,
    source: CalendarEventSource.MANUAL,
    requires_human_review: false,
    ...partial,
  };
}

describe("buildAgendaListSections", () => {
  const todayKey = "2026-01-10";
  const tomorrowKey = "2026-01-11";
  const weekEndKey = "2026-01-18";

  it("coloca atrasados primeiro e remove duplicata do restante", () => {
    const overdue = [evt({ id: "o1", date: "2026-01-01", start: "10:00" })];
    const visible = [evt({ id: "o1", date: "2026-01-01", start: "10:00" }), evt({ id: "t1", date: todayKey, start: "09:00" })];
    const sections = buildAgendaListSections(visible, overdue, todayKey, tomorrowKey, weekEndKey);
    expect(sections.map((s) => s.id)).toEqual(["overdue", "today"]);
    expect(sections[0]!.events.map((e) => e.id)).toEqual(["o1"]);
    expect(sections[1]!.events.map((e) => e.id)).toEqual(["t1"]);
  });

  it("agrupa amanhã, esta semana e depois", () => {
    const visible = [
      evt({ id: "m1", date: tomorrowKey, start: "14:00" }),
      evt({ id: "w1", date: "2026-01-15", start: "11:00" }),
      evt({ id: "l1", date: "2026-01-25", start: "08:00" }),
    ];
    const sections = buildAgendaListSections(visible, [], todayKey, tomorrowKey, weekEndKey);
    expect(sections.map((s) => s.id)).toEqual(["tomorrow", "this_week", "later"]);
    expect(sections[0]!.events[0]!.id).toBe("m1");
    expect(sections[1]!.events[0]!.id).toBe("w1");
    expect(sections[2]!.events[0]!.id).toBe("l1");
  });

  it("ordena atrasados por data/hora e o mesmo dia por start", () => {
    const overdue = [
      evt({ id: "a2", date: "2026-01-02", start: "15:00" }),
      evt({ id: "a1", date: "2026-01-02", start: "09:00" }),
      evt({ id: "a0", date: "2026-01-01", start: "12:00" }),
    ];
    const sections = buildAgendaListSections([], overdue, todayKey, tomorrowKey, weekEndKey);
    expect(sections[0]!.events.map((e) => e.id)).toEqual(["a0", "a1", "a2"]);
  });

  it("não inclui seções vazias", () => {
    const visible = [evt({ id: "only", date: todayKey, start: "10:00" })];
    const sections = buildAgendaListSections(visible, [], todayKey, tomorrowKey, weekEndKey);
    expect(sections.map((s) => s.id)).toEqual(["today"]);
  });
});
