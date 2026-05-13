import { NextResponse } from "next/server";
import { z } from "zod";
import { CalendarEventSource, CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { calendarEventListInclude } from "@/lib/calendar/calendar-queries";
import { serializeCalendarEvent } from "@/lib/calendar/calendar-serialize";
import { assertCalendarEventInWorkspace, CalendarValidationError, validateCalendarEventLinks } from "@/lib/calendar/calendar-validation";

export const runtime = "nodejs";

const patchBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(20000).optional().nullable(),
    eventType: z.nativeEnum(CalendarEventType).optional(),
    status: z.nativeEnum(CalendarEventStatus).optional(),
    startsAt: z.string().datetime().optional(),
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
  })
  .strict();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  try {
    await assertCalendarEventInWorkspace(workspaceId, id);
  } catch (e) {
    if (e instanceof CalendarValidationError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
  const row = await prisma.calendarEvent.findFirst({
    where: { id, workspaceId },
    include: calendarEventListInclude,
  });
  if (!row) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  return NextResponse.json({ event: serializeCalendarEvent(row) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  try {
    await assertCalendarEventInWorkspace(workspaceId, id);
  } catch (e) {
    if (e instanceof CalendarValidationError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }

  let body: z.infer<typeof patchBodySchema>;
  try {
    body = patchBodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const existing = await prisma.calendarEvent.findFirstOrThrow({
    where: { id, workspaceId },
    select: {
      startsAt: true,
      source: true,
      caseId: true,
      legalProcessId: true,
      processId: true,
      documentId: true,
    },
  });

  const startsAt = body.startsAt ? new Date(body.startsAt) : undefined;
  const endsAt = body.endsAt === null ? null : body.endsAt ? new Date(body.endsAt) : undefined;
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "startsAt inválido" }, { status: 400 });
  }
  const baseStart = startsAt ?? existing.startsAt;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "endsAt inválido" }, { status: 400 });
  }
  if (endsAt && endsAt < baseStart) {
    return NextResponse.json({ error: "endsAt deve ser posterior a startsAt" }, { status: 400 });
  }

  if (body.assignedToUserId) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId, userId: body.assignedToUserId },
      select: { id: true },
    });
    if (!m) {
      return NextResponse.json({ error: "Responsável não pertence a este workspace." }, { status: 400 });
    }
  }

  const nextCaseId = body.caseId !== undefined ? body.caseId : existing.caseId;
  const nextLegalProcessId = body.legalProcessId !== undefined ? body.legalProcessId : existing.legalProcessId;
  const nextProcessId = body.processId !== undefined ? body.processId : existing.processId;
  const nextDocumentId = body.documentId !== undefined ? body.documentId : existing.documentId;

  if (
    body.caseId !== undefined ||
    body.legalProcessId !== undefined ||
    body.processId !== undefined ||
    body.documentId !== undefined
  ) {
    try {
      await validateCalendarEventLinks({
        workspaceId,
        caseId: nextCaseId,
        legalProcessId: nextLegalProcessId,
        processId: nextProcessId,
        documentId: nextDocumentId,
      });
    } catch (e) {
      if (e instanceof CalendarValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  }

  const nextSource = body.source ?? existing.source;
  const requiresHumanReview = nextSource === CalendarEventSource.OFFICIAL_COMMUNICATION;

  const row = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.eventType !== undefined ? { eventType: body.eventType } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
      ...(body.allDay !== undefined ? { allDay: body.allDay } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
      ...(body.legalProcessId !== undefined ? { legalProcessId: body.legalProcessId } : {}),
      ...(body.processId !== undefined ? { processId: body.processId } : {}),
      ...(body.documentId !== undefined ? { documentId: body.documentId } : {}),
      ...(body.assignedToUserId !== undefined ? { assignedToUserId: body.assignedToUserId } : {}),
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.sourceRefId !== undefined ? { sourceRefId: body.sourceRefId } : {}),
      ...(body.reminderMinutesBefore !== undefined ? { reminderMinutesBefore: body.reminderMinutesBefore } : {}),
      requiresHumanReview,
    },
    include: calendarEventListInclude,
  });

  return NextResponse.json({ event: serializeCalendarEvent(row) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  try {
    await assertCalendarEventInWorkspace(workspaceId, id);
  } catch (e) {
    if (e instanceof CalendarValidationError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
