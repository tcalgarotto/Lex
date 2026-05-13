import type { CalendarEventWithRelations } from "@/lib/calendar/calendar-queries";

export function serializeCalendarEvent(e: CalendarEventWithRelations) {
  return {
    id: e.id,
    workspaceId: e.workspaceId,
    caseId: e.caseId,
    legalProcessId: e.legalProcessId,
    processId: e.processId,
    documentId: e.documentId,
    title: e.title,
    description: e.description,
    eventType: e.eventType,
    status: e.status,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    allDay: e.allDay,
    timezone: e.timezone,
    assignedToUserId: e.assignedToUserId,
    createdByUserId: e.createdByUserId,
    source: e.source,
    sourceRefId: e.sourceRefId,
    requiresHumanReview: e.requiresHumanReview,
    reminderMinutesBefore: e.reminderMinutesBefore,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    case: e.case,
    legalProcess: e.legalProcess,
    process: e.process,
    document: e.document,
    assignedTo: e.assignedTo,
    createdBy: e.createdBy,
  };
}
