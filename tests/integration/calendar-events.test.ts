import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CalendarEventSource,
  CalendarEventStatus,
  CalendarEventType,
  MembershipRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCalendarDashboardBuckets } from "@/lib/calendar/calendar-queries";

let mockWorkspaceId = "";
const mockUserId = "test-user-calendar-events";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn(async () => ({
    workspaceId: mockWorkspaceId,
    user: { id: mockUserId },
  })),
}));

import * as CalendarEventsRoute from "@/app/api/calendar/events/route";
import * as CalendarEventIdRoute from "@/app/api/calendar/events/[id]/route";

async function createWorkspace(name: string) {
  const ws = await prisma.workspace.create({
    data: { name, slug: `${name}-${Math.random().toString(16).slice(2)}` },
    select: { id: true },
  });
  return ws.id;
}

describe("calendar events (workspace + links)", () => {
  let wsA: string;
  let wsB: string;
  let caseId = "";
  let processId = "";
  let legalProcessId = "";

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: mockUserId },
      update: {},
      create: { id: mockUserId, email: `${mockUserId}@test.local`, name: "Cal User" },
    });
    wsA = await createWorkspace("wsA-cal");
    wsB = await createWorkspace("wsB-cal");
    await prisma.membership.create({
      data: { workspaceId: wsA, userId: mockUserId, role: MembershipRole.LAWYER },
    });
    await prisma.membership.create({
      data: { workspaceId: wsB, userId: mockUserId, role: MembershipRole.LAWYER },
    });

    const c = await prisma.case.create({
      data: {
        workspaceId: wsA,
        createdById: mockUserId,
        title: "Caso cal",
        rawInput: "x",
        status: "INTAKE",
      },
      select: { id: true },
    });
    caseId = c.id;

    const suffix = Math.random().toString(16).slice(2, 10);
    const cnj = `0000000${suffix.slice(0, 7)}-00.0000.0.00.0000`;
    const proc = await prisma.process.create({
      data: {
        workspaceId: wsA,
        number: cnj,
        title: "Proc teste",
        tribunal: "TJSP",
      },
      select: { id: true },
    });
    processId = proc.id;

    const lp = await prisma.legalProcess.create({
      data: {
        workspaceId: wsA,
        processId,
        caseId,
        cnj,
        cnjFormatted: cnj,
        tribunalAcronym: "TJSP",
        tribunalAlias: "tjsp",
        branch: "1",
      },
      select: { id: true },
    });
    legalProcessId = lp.id;
  });

  afterEach(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
    await prisma.user.deleteMany({ where: { id: mockUserId } });
  });

  it("POST cria evento e GET lista no workspace", async () => {
    mockWorkspaceId = wsA;
    const startsAt = new Date("2026-07-01T14:00:00.000Z").toISOString();
    const createRes = await CalendarEventsRoute.POST(
      new Request("http://test.local/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Reunião",
          eventType: CalendarEventType.CLIENT_MEETING,
          startsAt,
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { event: { id: string } };
    const eventId = created.event.id;

    const from = new Date("2026-06-01").toISOString();
    const to = new Date("2026-07-31").toISOString();
    const listRes = await CalendarEventsRoute.GET(
      new Request(`http://test.local/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { events: Array<{ id: string }> };
    expect(listJson.events.some((e) => e.id === eventId)).toBe(true);
  });

  it("vincula a caso e a processo judicial", async () => {
    mockWorkspaceId = wsA;
    const startsAt = new Date("2026-07-02T10:00:00.000Z").toISOString();
    const res = await CalendarEventsRoute.POST(
      new Request("http://test.local/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Audiência",
          eventType: CalendarEventType.HEARING,
          startsAt,
          caseId,
          processId,
          legalProcessId,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { event: { caseId: string | null; processId: string | null } };
    expect(body.event.caseId).toBe(caseId);
    expect(body.event.processId).toBe(processId);
  });

  it("GET por id retorna 404 fora do workspace", async () => {
    mockWorkspaceId = wsA;
    const createRes = await CalendarEventsRoute.POST(
      new Request("http://test.local/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Só A",
          startsAt: new Date("2026-08-01T12:00:00.000Z").toISOString(),
        }),
      }),
    );
    const { event } = (await createRes.json()) as { event: { id: string } };

    mockWorkspaceId = wsB;
    const denied = await CalendarEventIdRoute.GET(new Request("http://test.local/api/calendar/events/x"), {
      params: Promise.resolve({ id: event.id }),
    });
    expect(denied.status).toBe(404);
  });

  it("fonte comunicação oficial marca revisão humana", async () => {
    mockWorkspaceId = wsA;
    const res = await CalendarEventsRoute.POST(
      new Request("http://test.local/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Revisar intimação",
          eventType: CalendarEventType.REVIEW_COMMUNICATION,
          startsAt: new Date("2026-08-10T12:00:00.000Z").toISOString(),
          source: CalendarEventSource.OFFICIAL_COMMUNICATION,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { event: { requiresHumanReview: boolean } };
    expect(body.event.requiresHumanReview).toBe(true);
  });

  it("dashboard: pendente atrasado entra em overdue; concluído some", async () => {
    const now = new Date("2026-06-15T15:00:00.000Z");
    const past = new Date("2026-06-14T15:00:00.000Z");

    await prisma.calendarEvent.create({
      data: {
        workspaceId: wsA,
        title: "Atrasado",
        eventType: CalendarEventType.INTERNAL_TASK,
        status: CalendarEventStatus.PENDING,
        startsAt: past,
        createdByUserId: mockUserId,
        timezone: "America/Sao_Paulo",
      },
    });

    const before = await getCalendarDashboardBuckets(wsA, now);
    expect(before.overdue.some((e) => e.title === "Atrasado")).toBe(true);

    await prisma.calendarEvent.updateMany({
      where: { workspaceId: wsA, title: "Atrasado" },
      data: { status: CalendarEventStatus.DONE },
    });

    const after = await getCalendarDashboardBuckets(wsA, now);
    expect(after.overdue.some((e) => e.title === "Atrasado")).toBe(false);
  });
});
