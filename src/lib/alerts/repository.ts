/**
 * Repository de alertas (timeline jurídica viva) — multi-tenant.
 *
 * Idempotente via UNIQUE (workspaceId, fingerprint). Se um alerta com
 * a mesma fingerprint já existir, retorna `created: false` e mantém o
 * registro original (não atualiza payload, mas atualiza updatedAt).
 */

import {
  CaseAlertKind,
  CaseAlertSeverity,
  CaseAlertStatus,
  NotificationKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fingerprintOf } from "@/lib/integrations/fingerprint";
import type { IntegrationEvent } from "@/lib/integrations/types";
import type { AlertInput } from "./types";

export type UpsertAlertArgs = {
  workspaceId: string;
  alert: AlertInput;
};

export type UpsertAlertResult = {
  alertId: string;
  created: boolean;
};

export async function upsertAlert(args: UpsertAlertArgs): Promise<UpsertAlertResult> {
  const { workspaceId, alert } = args;
  const fingerprint = fingerprintOf([
    alert.kind,
    alert.caseId ?? "",
    alert.reference ?? "",
    ...(alert.fingerprintExtras ?? []),
  ]);

  try {
    const existing = await prisma.caseAlert.findUnique({
      where: { workspaceId_fingerprint: { workspaceId, fingerprint } },
    });
    if (existing) {
      await prisma.caseAlert.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
      return { alertId: existing.id, created: false };
    }
    const created = await prisma.caseAlert.create({
      data: {
        workspaceId,
        ...(alert.caseId ? { caseId: alert.caseId } : {}),
        kind: alert.kind,
        severity: alert.severity,
        status: CaseAlertStatus.OPEN,
        title: alert.title,
        message: alert.message,
        ...(alert.reference ? { reference: alert.reference } : {}),
        fingerprint,
        ...(alert.payload
          ? { payloadJson: alert.payload as Prisma.InputJsonValue }
          : {}),
      },
    });

    await prisma.notification.create({
      data: {
        workspaceId,
        kind: NotificationKind.ALERT,
        title: alert.title,
        body: alert.message,
        href: alert.caseId ? `/cases/${alert.caseId}` : "/cockpit",
        refIds: alert.caseId ? [alert.caseId, created.id] : [created.id],
        payloadJson: { severity: alert.severity, kind: alert.kind },
      },
    });

    return { alertId: created.id, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.caseAlert.findUnique({
        where: { workspaceId_fingerprint: { workspaceId, fingerprint } },
      });
      if (existing) return { alertId: existing.id, created: false };
    }
    throw e;
  }
}

const SEVERITY_BY_KIND: Record<IntegrationEvent["kind"], CaseAlertSeverity> = {
  PROCESS_MOVEMENT: CaseAlertSeverity.MEDIUM,
  PUBLICATION: CaseAlertSeverity.HIGH,
  INTIMATION: CaseAlertSeverity.HIGH,
  DEADLINE: CaseAlertSeverity.HIGH,
  MESSAGE_INBOUND: CaseAlertSeverity.LOW,
  MESSAGE_OUTBOUND: CaseAlertSeverity.INFO,
  DELIVERY_RECEIPT: CaseAlertSeverity.INFO,
  WEBHOOK: CaseAlertSeverity.LOW,
  SYSTEM: CaseAlertSeverity.INFO,
};

const KIND_BY_EVENT: Record<IntegrationEvent["kind"], CaseAlertKind> = {
  PROCESS_MOVEMENT: CaseAlertKind.RELEVANT_MOVEMENT,
  PUBLICATION: CaseAlertKind.RELEVANT_MOVEMENT,
  INTIMATION: CaseAlertKind.DEADLINE,
  DEADLINE: CaseAlertKind.DEADLINE,
  MESSAGE_INBOUND: CaseAlertKind.RELEVANT_MOVEMENT,
  MESSAGE_OUTBOUND: CaseAlertKind.STRATEGIC_HISTORY,
  DELIVERY_RECEIPT: CaseAlertKind.STRATEGIC_HISTORY,
  WEBHOOK: CaseAlertKind.RELEVANT_MOVEMENT,
  SYSTEM: CaseAlertKind.STRATEGIC_HISTORY,
};

/**
 * Converte um `IntegrationEvent` em `CaseAlert`, fazendo match com o caso
 * mais provável via processNumber+workspaceId quando possível.
 */
export async function upsertAlertFromEvent(args: {
  workspaceId: string;
  event: IntegrationEvent;
}): Promise<UpsertAlertResult> {
  const { workspaceId, event } = args;
  const kind = KIND_BY_EVENT[event.kind];
  const severity = SEVERITY_BY_KIND[event.kind];
  let caseId: string | null = null;
  if (event.caseRef?.processNumber) {
    const c = await prisma.case.findFirst({
      where: { workspaceId, processNumber: event.caseRef.processNumber },
      select: { id: true },
    });
    if (c) caseId = c.id;
  }
  return upsertAlert({
    workspaceId,
    alert: {
      kind,
      severity,
      title: event.title,
      message: event.body,
      caseId,
      ...(event.caseRef?.processNumber ? { reference: event.caseRef.processNumber } : {}),
      fingerprintExtras: [event.provider, event.fingerprint, event.occurredAt],
      ...(event.payload ? { payload: event.payload } : {}),
    },
  });
}

export type ListAlertsArgs = {
  workspaceId: string;
  status?: CaseAlertStatus[];
  severity?: CaseAlertSeverity[];
  caseId?: string;
  take?: number;
};

export async function listAlerts(args: ListAlertsArgs) {
  const where: Prisma.CaseAlertWhereInput = { workspaceId: args.workspaceId };
  if (args.status?.length) where.status = { in: args.status };
  if (args.severity?.length) where.severity = { in: args.severity };
  if (args.caseId) where.caseId = args.caseId;
  return prisma.caseAlert.findMany({
    where,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(200, args.take ?? 50)),
  });
}

export async function ackAlert(args: {
  workspaceId: string;
  alertId: string;
  userId: string;
}) {
  return prisma.caseAlert.updateMany({
    where: { id: args.alertId, workspaceId: args.workspaceId, status: CaseAlertStatus.OPEN },
    data: {
      status: CaseAlertStatus.ACKED,
      ackedAt: new Date(),
      ackedById: args.userId,
    },
  });
}

export async function resolveAlert(args: {
  workspaceId: string;
  alertId: string;
}) {
  return prisma.caseAlert.updateMany({
    where: { id: args.alertId, workspaceId: args.workspaceId },
    data: { status: CaseAlertStatus.RESOLVED, resolvedAt: new Date() },
  });
}

export async function dismissAlert(args: {
  workspaceId: string;
  alertId: string;
}) {
  return prisma.caseAlert.updateMany({
    where: { id: args.alertId, workspaceId: args.workspaceId },
    data: { status: CaseAlertStatus.DISMISSED },
  });
}
