import { describe, expect, it } from "vitest";
import { renderIcs, toIcsDate, calendarAdapter } from "./calendar";

describe("toIcsDate", () => {
  it("converte ISO para formato ICS Z", () => {
    expect(toIcsDate("2026-05-07T13:30:00Z")).toBe("20260507T133000Z");
  });
  it("rejeita ISO inválido", () => {
    expect(() => toIcsDate("not-a-date")).toThrow();
  });
});

describe("renderIcs", () => {
  it("renderiza VCALENDAR/VEVENT com escape de campos", () => {
    const ics = renderIcs([
      {
        id: "ev1",
        title: "Audiência, parte adversa; ABC",
        start: "2026-06-01T14:00:00Z",
        end: "2026-06-01T15:00:00Z",
        description: "Linha 1\nLinha 2",
        location: "TJSP",
      },
    ]);
    expect(ics).toMatch(/BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR/);
    expect(ics).toMatch(/SUMMARY:Audiência\\, parte adversa\\; ABC/);
    expect(ics).toMatch(/DESCRIPTION:Linha 1\\nLinha 2/);
    expect(ics).toMatch(/UID:[^@]+@lex/);
  });

  it("UID é determinístico para o mesmo título+start", () => {
    const a = renderIcs([{ id: "1", title: "x", start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z" }]);
    const b = renderIcs([{ id: "2", title: "x", start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z" }]);
    const uidA = /UID:([^\r\n]+)/.exec(a)?.[1];
    const uidB = /UID:([^\r\n]+)/.exec(b)?.[1];
    expect(uidA).toBe(uidB);
  });
});

describe("calendarAdapter health", () => {
  it("ICS_ONLY quando sem secret", async () => {
    const h = await calendarAdapter.health({ workspaceId: "ws" });
    expect(h.ok).toBe(true);
    expect(h.code).toBe("ICS_ONLY");
  });
});
