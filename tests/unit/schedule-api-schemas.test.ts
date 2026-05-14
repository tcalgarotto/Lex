import { describe, expect, it } from "vitest";
import { scheduleEventPostSchema } from "@/lib/calendar/schedule-api-schemas";

describe("scheduleEventPostSchema", () => {
  it("aceita compromisso mínimo", () => {
    const body = {
      title: "Reunião",
      type: "reuniao",
      date: "2026-05-20",
      start: "09:00",
      end: "10:00",
      all_day: false,
    };
    expect(() => scheduleEventPostSchema.parse(body)).not.toThrow();
    expect(scheduleEventPostSchema.parse(body).title).toBe("Reunião");
  });

  it("aceita all_day com start 00:00", () => {
    const body = {
      title: "Audiência dia",
      type: "audiencia",
      date: "2026-06-01",
      start: "00:00",
      end: null,
      all_day: true,
    };
    const p = scheduleEventPostSchema.parse(body);
    expect(p.all_day).toBe(true);
    expect(p.start).toBe("00:00");
  });

  it("aceita local (location)", () => {
    const body = {
      title: "Sala",
      type: "interno",
      date: "2026-05-01",
      start: "14:30",
      local: "Fórum Central, sala 2",
    };
    expect(scheduleEventPostSchema.parse(body).local).toBe("Fórum Central, sala 2");
  });

  it("aceita hora com um dígito na hora (normalizável no cliente)", () => {
    const body = {
      title: "x",
      type: "interno",
      date: "2026-05-01",
      start: "9:05",
    };
    expect(scheduleEventPostSchema.parse(body).start).toBe("9:05");
  });

  it("rejeita título só com espaços após trim", () => {
    expect(() =>
      scheduleEventPostSchema.parse({
        title: "   ",
        type: "interno",
        date: "2026-05-01",
        start: "09:00",
      }),
    ).toThrow();
  });

  it("rejeita título vazio", () => {
    expect(() =>
      scheduleEventPostSchema.parse({
        title: "",
        type: "interno",
        date: "2026-05-01",
        start: "09:00",
      }),
    ).toThrow();
  });
});
