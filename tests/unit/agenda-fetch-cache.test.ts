import { describe, expect, it } from "vitest";
import {
  buildScheduleFetchKey,
  eventDtoInFetchedRange,
  mergeEventIntoList,
  removeEventFromList,
} from "@/lib/calendar/agenda-fetch-cache";
import type { ScheduleEventDto } from "@/lib/calendar/schedule-shapes";

function ev(partial: Partial<ScheduleEventDto> & Pick<ScheduleEventDto, "id" | "date">): ScheduleEventDto {
  return {
    title: "x",
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
    prisma_event_type: "INTERNAL_TASK",
    status: "PENDING",
    all_day: false,
    start: "09:00",
    end: "10:00",
    local: null,
    obs: null,
    source: "MANUAL",
    requires_human_review: false,
    ...partial,
  };
}

describe("buildScheduleFetchKey", () => {
  it("concatena parâmetros em ordem estável", () => {
    const from = new Date("2024-06-01T12:00:00.000Z");
    const to = new Date("2024-06-30T12:00:00.000Z");
    const a = buildScheduleFetchKey({
      from,
      to,
      casoId: "c1",
      responsavelId: "u1",
      eventTypeSlug: "prazo",
      includeDone: true,
      includeCancelled: false,
    });
    const b = buildScheduleFetchKey({
      from,
      to,
      casoId: "c1",
      responsavelId: "u1",
      eventTypeSlug: "prazo",
      includeDone: true,
      includeCancelled: false,
    });
    expect(a).toBe(b);
    expect(a).toContain(from.toISOString());
    expect(a).toContain("prazo");
    expect(a).toMatch(/1\|0$/);
  });

  it("muda quando filtros booleanos mudam", () => {
    const from = new Date("2024-06-01T12:00:00.000Z");
    const to = new Date("2024-06-30T12:00:00.000Z");
    const base = {
      from,
      to,
      casoId: "",
      responsavelId: "",
      eventTypeSlug: "" as const,
      includeDone: false,
      includeCancelled: false,
    };
    expect(buildScheduleFetchKey({ ...base, includeDone: true })).not.toBe(buildScheduleFetchKey(base));
  });
});

describe("eventDtoInFetchedRange", () => {
  it("inclui data dentro do intervalo (fuso agenda)", () => {
    const from = new Date("2024-06-15T03:00:00.000Z");
    const to = new Date("2024-06-15T10:00:00.000Z");
    const e = ev({ id: "1", date: "2024-06-15" });
    expect(eventDtoInFetchedRange(e, from, to)).toBe(true);
  });

  it("exclui data fora do intervalo", () => {
    const from = new Date("2024-06-15T03:00:00.000Z");
    const to = new Date("2024-06-15T10:00:00.000Z");
    const e = ev({ id: "1", date: "2024-06-16" });
    expect(eventDtoInFetchedRange(e, from, to)).toBe(false);
  });
});

describe("mergeEventIntoList / removeEventFromList", () => {
  it("insere novo e substitui por id", () => {
    const a = ev({ id: "a", date: "2024-01-01", title: "old" });
    const _b = ev({ id: "b", date: "2024-01-02", title: "x" });
    const merged = mergeEventIntoList([a], ev({ id: "b", date: "2024-01-02", title: "new" }));
    expect(merged).toHaveLength(2);
    const again = mergeEventIntoList(merged, ev({ id: "a", date: "2024-01-01", title: "upd" }));
    expect(again.find((x) => x.id === "a")?.title).toBe("upd");
  });

  it("remove por id", () => {
    const list = [ev({ id: "1", date: "2024-01-01" }), ev({ id: "2", date: "2024-01-02" })];
    expect(removeEventFromList(list, "1")).toHaveLength(1);
    expect(removeEventFromList(list, "1")[0]?.id).toBe("2");
  });
});
