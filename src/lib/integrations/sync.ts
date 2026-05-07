/**
 * Orquestrador de sync de integrações.
 *
 * Carrega todas as `Integration` ativas do workspace, chama `fetchEvents`
 * em cada adapter, persiste alertas idempotentes e notificações.
 *
 * Determinístico: a mesma chamada em sequência não duplica alertas
 * (graças ao fingerprint). Se uma integração estiver `PAUSED` ou
 * `DISCONNECTED`, é ignorada.
 */

import { IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "./registry";
import { upsertAlertFromEvent } from "@/lib/alerts/repository";
import type { IntegrationContext } from "./types";

export type SyncWorkspaceArgs = {
  workspaceId: string;
  /** Limite operacional por integração (default 25). */
  limitPerIntegration?: number;
};

export type SyncResult = {
  workspaceId: string;
  ranAt: string;
  perIntegration: Array<{
    integrationId: string;
    provider: string;
    label: string;
    eventsFetched: number;
    alertsCreated: number;
    alertsSkipped: number;
    error?: string;
  }>;
};

export async function syncWorkspace(args: SyncWorkspaceArgs): Promise<SyncResult> {
  const { workspaceId } = args;
  const limit = Math.max(1, Math.min(100, args.limitPerIntegration ?? 25));
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, status: { in: [IntegrationStatus.CONNECTED, IntegrationStatus.ERROR] } },
    orderBy: { createdAt: "asc" },
  });
  const ranAt = new Date().toISOString();
  const perIntegration: SyncResult["perIntegration"] = [];

  for (const integ of integrations) {
    const adapter = getAdapter(integ.provider);
    const ctx: IntegrationContext = {
      workspaceId,
      secretRef: integ.secretRef,
      config: integ.configJson as Record<string, unknown> | null,
    };
    if (!adapter.fetchEvents) {
      perIntegration.push({
        integrationId: integ.id,
        provider: integ.provider,
        label: integ.label,
        eventsFetched: 0,
        alertsCreated: 0,
        alertsSkipped: 0,
      });
      continue;
    }
    try {
      const since = integ.lastSyncedAt?.toISOString();
      const eventsArgs = since !== undefined ? { limit, since } : { limit };
      const events = await adapter.fetchEvents(ctx, eventsArgs);
      let created = 0;
      let skipped = 0;
      for (const ev of events) {
        const result = await upsertAlertFromEvent({ workspaceId, event: ev });
        if (result.created) created++;
        else skipped++;
      }
      await prisma.integration.update({
        where: { id: integ.id },
        data: {
          lastSyncedAt: new Date(),
          status: IntegrationStatus.CONNECTED,
          lastError: null,
        },
      });
      perIntegration.push({
        integrationId: integ.id,
        provider: integ.provider,
        label: integ.label,
        eventsFetched: events.length,
        alertsCreated: created,
        alertsSkipped: skipped,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.integration.update({
        where: { id: integ.id },
        data: { status: IntegrationStatus.ERROR, lastError: message },
      });
      perIntegration.push({
        integrationId: integ.id,
        provider: integ.provider,
        label: integ.label,
        eventsFetched: 0,
        alertsCreated: 0,
        alertsSkipped: 0,
        error: message,
      });
    }
  }

  return { workspaceId, ranAt, perIntegration };
}
