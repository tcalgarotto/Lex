import { prisma } from "@/lib/prisma";

export class CalendarValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarValidationError";
  }
}

export async function validateCalendarEventLinks(params: {
  workspaceId: string;
  caseId?: string | null;
  legalProcessId?: string | null;
  processId?: string | null;
  documentId?: string | null;
}): Promise<void> {
  const { workspaceId } = params;
  if (params.caseId) {
    const ok = await prisma.case.findFirst({
      where: { id: params.caseId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!ok) throw new CalendarValidationError("Caso não encontrado neste workspace.");
  }
  if (params.legalProcessId) {
    const ok = await prisma.legalProcess.findFirst({
      where: { id: params.legalProcessId, workspaceId },
      select: { id: true },
    });
    if (!ok) throw new CalendarValidationError("Processo judicial não encontrado neste workspace.");
  }
  if (params.processId) {
    const ok = await prisma.process.findFirst({
      where: { id: params.processId, workspaceId },
      select: { id: true },
    });
    if (!ok) throw new CalendarValidationError("Processo interno não encontrado neste workspace.");
  }
  if (params.documentId) {
    const ok = await prisma.document.findFirst({
      where: { id: params.documentId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!ok) throw new CalendarValidationError("Documento não encontrado neste workspace.");
  }
}

export async function assertCalendarEventInWorkspace(
  workspaceId: string,
  eventId: string,
): Promise<{ id: string }> {
  const row = await prisma.calendarEvent.findFirst({
    where: { id: eventId, workspaceId },
    select: { id: true },
  });
  if (!row) throw new CalendarValidationError("Evento não encontrado.");
  return row;
}
