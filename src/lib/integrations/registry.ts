/**
 * Registro central de adapters de integração.
 *
 * Importadores devem usar `getAdapter(provider)` em vez de importar
 * adapters diretamente — isso garante que o mapeamento fique sob controle
 * e auditável (nenhum adapter "soltinho" pode contornar o cofre/auth).
 */

import { IntegrationProvider } from "@prisma/client";
import type { IntegrationAdapter } from "./types";
import { pjeAdapter, esajAdapter, projudiAdapter, eprocAdapter } from "./tribunals";
import { diarioOficialAdapter } from "./diario-oficial";
import { emailAdapter, whatsappAdapter } from "./messaging";
import { calendarAdapter } from "./calendar";

const REGISTRY: Record<IntegrationProvider, IntegrationAdapter> = {
  [IntegrationProvider.PJE]: pjeAdapter,
  [IntegrationProvider.ESAJ]: esajAdapter,
  [IntegrationProvider.PROJUDI]: projudiAdapter,
  [IntegrationProvider.EPROC]: eprocAdapter,
  [IntegrationProvider.DIARIO_OFICIAL]: diarioOficialAdapter,
  [IntegrationProvider.EMAIL]: emailAdapter,
  [IntegrationProvider.WHATSAPP]: whatsappAdapter,
  [IntegrationProvider.CALENDAR]: calendarAdapter,
  [IntegrationProvider.WEBHOOK]: {
    provider: IntegrationProvider.WEBHOOK,
    async health() {
      return {
        ok: true,
        message: "Webhook genérico — receba eventos POST em /api/integrations/webhook.",
        code: "READY",
        checkedAt: new Date().toISOString(),
      };
    },
  },
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter {
  const adapter = REGISTRY[provider];
  if (!adapter) {
    throw new Error(`Integration provider sem adapter registrado: ${provider}`);
  }
  return adapter;
}

export const ALL_PROVIDERS = Object.values(IntegrationProvider);
