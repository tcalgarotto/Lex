import { NextResponse } from "next/server";
import { z } from "zod";
import { CalendarEventSource, CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { endOfMonth, startOfMonth } from "date-fns";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listCalendarEvents } from "@/lib/calendar/calendar-queries";
import { serializeCalendarEvent } from "@/lib/calendar/calendar-serialize";
import { CalendarValidationError, validateCalendarEventLinks } from "@/lib/calendar/calendar-validation";

export const runtime = "nodejs";

const createBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(20000).optional().nullable(),
  eventType: z.nativeEnum(CalendarEventType).default(CalendarEventType.OTHER),
  status: z.nativeEnum(CalendarEventStatus).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  timezone: z.string().min(1).max(80).optional(),
  caseId: z.string().optional().nullable(),
  legalProcessId: z.string().optional().nullable(),
  processId: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  source: z.nativeEnum(CalendarEventSource).optional(),
  sourceRefId: z.string().optional().nullable(),
  reminderMinutesBefore: z.number().int().min(0).max(10080).optional().nullable(),
});

function parseMonthRange(month: string | null): { from: Date; to: Date } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      const anchor = new Date(y, m - 1, 15);
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    }
  }
  const anchor = new Date();
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/**
 * GET /api/calendar/events — lista eventos do workspace (filtros opcionais).
 * POST — cria evento.
 */
export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(req.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const month = url.searchParams.get("month");

  let from: Date | undefined;
  let to: Date | undefined;
  if (fromRaw && toRaw) {
    from = new Date(fromRaw);
    to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Parâmetros from/to inválidos" }, { status: 400 });
    }
  } else {
    const r = parseMonthRange(month);
    from = r.from;
    to = r.to;
  }

  const events = await listCalendarEvents({
    workspaceId,
    from,
    to,
    caseId: url.searchParams.get("caseId"),
    legalProcessId: url.searchParams.get("legalProcessId"),
    processId: url.searchParams.get("processId"),
    documentId: url.searchParams.get("documentId"),
    assignedToUserId: url.searchParams.get("assignedToUserId"),
    eventType: url.searchParams.get("eventType"),
    status: url.searchParams.get("status"),
  });

  return NextResponse.json({ events: events.map(serializeCalendarEvent) });
}

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  let body: z.infer<typeof createBodySchema>;
  try {
    body = createBodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "startsAt inválido" }, { status: 400 });
  }
  if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt)) {
    return NextResponse.json({ error: "endsAt deve ser posterior a startsAt" }, { status: 400 });
  }

  const source = body.source ?? CalendarEventSource.MANUAL;
  const requiresHumanReview = source === CalendarEventSource.OFFICIAL_COMMUNICATION;

  if (body.assignedToUserId) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId, userId: body.assignedToUserId },
      select: { id: true },
    });
    if (!m) {
      return NextResponse.json({ error: "Responsável não pertence a este workspace." }, { status: 400 });
    }
  }

  try {
    await validateCalendarEventLinks({
      workspaceId,
      caseId: body.caseId,
      legalProcessId: body.legalProcessId,
      processId: body.processId,
      documentId: body.documentId,
    });
  } catch (e) {
    if (e instanceof CalendarValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const row = await prisma.calendarEvent.create({
    data: {
      workspaceId,
      title: body.title,
      description: body.description ?? null,
      eventType: body.eventType,
      status: body.status ?? CalendarEventStatus.PENDING,
      startsAt,
      endsAt,
      allDay: body.allDay ?? false,
      timezone: body.timezone ?? "America/Sao_Paulo",
      caseId: body.caseId ?? null,
      legalProcessId: body.legalProcessId ?? null,
      processId: body.processId ?? null,
      documentId: body.documentId ?? null,
      assignedToUserId: body.assignedToUserId ?? null,
      createdByUserId: user.id,
      source,
      sourceRefId: body.sourceRefId ?? null,
      requiresHumanReview,
      reminderMinutesBefore: body.reminderMinutesBefore ?? null,
    },
    include: {
      case: { select: { id: true, title: true } },
      legalProcess: { select: { id: true, cnjFormatted: true } },
      process: { select: { id: true, number: true, title: true } },
      document: { select: { id: true, originalName: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ event: serializeCalendarEvent(row) }, { status: 201 });
}
