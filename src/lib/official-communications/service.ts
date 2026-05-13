import {
  LegalProcessAlertSeverity,
  LegalProcessAlertStatus,
  LegalProcessAlertType,
  OfficialCommunicationSource,
  OfficialCommunicationStatus,
  OfficialCommunicationType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateOfficialCommunicationInput = {
  workspaceId: string;
  createdByUserId?: string | null;
  legalProcessId?: string | null;
  processId?: string | null;
  caseId?: string | null;
  documentId?: string | null;
  source: OfficialCommunicationSource;
  communicationType: OfficialCommunicationType;
  receivedAt?: Date | null;
  availableAt?: Date | null;
  readAt?: Date | null;
  dueReviewAt?: Date | null;
  title: string;
  description?: string | null;
  rawText?: string | null;
};

export function parseOfficialCommunicationDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeOfficialCommunicationType(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.toUpperCase() : "";
  return Object.values(OfficialCommunicationType).includes(raw as OfficialCommunicationType)
    ? (raw as OfficialCommunicationType)
    : OfficialCommunicationType.OUTRO;
}

export function normalizeOfficialCommunicationSource(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.toUpperCase() : "";
  return Object.values(OfficialCommunicationSource).includes(raw as OfficialCommunicationSource)
    ? (raw as OfficialCommunicationSource)
    : OfficialCommunicationSource.MANUAL;
}

export async function createOfficialCommunication(input: CreateOfficialCommunicationInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Título obrigatório");

  const [legalProcess, proc, caseRecord, document] = await Promise.all([
    input.legalProcessId
      ? prisma.legalProcess.findFirst({
          where: { id: input.legalProcessId, workspaceId: input.workspaceId },
          select: { id: true, processId: true, cnjFormatted: true },
        })
      : Promise.resolve(null),
    input.processId
      ? prisma.process.findFirst({
          where: { id: input.processId, workspaceId: input.workspaceId },
          select: { id: true, number: true },
        })
      : Promise.resolve(null),
    input.caseId
      ? prisma.case.findFirst({
          where: { id: input.caseId, workspaceId: input.workspaceId },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.documentId
      ? prisma.document.findFirst({
          where: { id: input.documentId, workspaceId: input.workspaceId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (input.legalProcessId && !legalProcess) throw new Error("Processo DataJud não encontrado");
  if (input.processId && !proc) throw new Error("Processo não encontrado");
  if (input.caseId && !caseRecord) throw new Error("Caso não encontrado");
  if (input.documentId && !document) throw new Error("Documento não encontrado");

  const resolvedProcessId = input.processId ?? legalProcess?.processId ?? null;
  const communication = await prisma.officialCommunication.create({
    data: {
      workspaceId: input.workspaceId,
      legalProcessId: legalProcess?.id ?? null,
      processId: resolvedProcessId,
      caseId: caseRecord?.id ?? null,
      documentId: document?.id ?? null,
      source: input.source,
      communicationType: input.communicationType,
      receivedAt: input.receivedAt ?? null,
      availableAt: input.availableAt ?? null,
      readAt: input.readAt ?? null,
      dueReviewAt: input.dueReviewAt ?? null,
      status: OfficialCommunicationStatus.NEEDS_REVIEW,
      title,
      description: input.description?.trim() || null,
      rawText: input.rawText?.trim() || null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId: input.workspaceId,
      kind: "official_communication.created",
      title: `Comunicação oficial registrada: ${title}`,
      metaJson: {
        officialCommunicationId: communication.id,
        source: input.source,
        communicationType: input.communicationType,
        processId: resolvedProcessId,
        caseId: caseRecord?.id ?? null,
        legalProcessId: legalProcess?.id ?? null,
        requiresHumanReview: true,
      },
    },
  });

  if (resolvedProcessId) {
    await prisma.processTimelineEvent.create({
      data: {
        processId: resolvedProcessId,
        title: `Fonte oficial: ${title}`,
        description:
          input.description?.trim() ||
          "Comunicação/importação manual registrada a partir de fonte oficial. Revisão humana obrigatória.",
        metaJson: {
          officialCommunicationId: communication.id,
          source: input.source,
          communicationType: input.communicationType,
          requiresHumanReview: true,
        },
      },
    });
  }

  if (legalProcess?.id) {
    await prisma.legalProcessAlert.upsert({
      where: { workspaceId_fingerprint: { workspaceId: input.workspaceId, fingerprint: `official-communication:${communication.id}` } },
      update: {},
      create: {
        workspaceId: input.workspaceId,
        legalProcessId: legalProcess.id,
        type: LegalProcessAlertType.ATTENTION,
        severity: LegalProcessAlertSeverity.MEDIUM,
        status: LegalProcessAlertStatus.OPEN,
        title: "Revisar comunicação oficial",
        description: "Comunicação importada manualmente de fonte oficial. Confira no portal oficial antes de calcular prazo ou tomar providência.",
        fingerprint: `official-communication:${communication.id}`,
        payloadJson: { officialCommunicationId: communication.id, source: input.source, communicationType: input.communicationType },
      },
    });
  }

  return communication;
}
