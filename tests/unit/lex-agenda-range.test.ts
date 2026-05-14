import { describe, expect, it } from "vitest";
import { endOfMonth, startOfMonth } from "date-fns";
import { scheduleRangeForView, weekDaysMondayStart } from "@/lib/calendar/lex-agenda-range";

describe("scheduleRangeForView", () => {
  it("month range covers full week grid around anchor month (semana começa no domingo)", () => {
    const anchor = new Date(2026, 4, 13);
    const ms = startOfMonth(anchor);
    const { from, to } = scheduleRangeForView("month", ms);
    expect(from.getDay()).toBe(0);
    expect(from.getTime()).toBeLessThanOrEqual(ms.getTime());
    expect(to.getTime()).toBeGreaterThanOrEqual(endOfMonth(anchor).getTime());
  });

  it("day range is single calendar day", () => {
    const anchor = new Date(2026, 4, 13, 15, 30);
    const { from, to } = scheduleRangeForView("day", anchor);
    expect(from.getDate()).toBe(13);
    expect(to.getDate()).toBe(13);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("weekDaysMondayStart", () => {
  it("returns 7 days starting Monday", () => {
    const days = weekDaysMondayStart(new Date(2026, 4, 13));
    expect(days).toHaveLength(7);
    expect(days[0]?.getDay()).toBe(1);
  });
});
