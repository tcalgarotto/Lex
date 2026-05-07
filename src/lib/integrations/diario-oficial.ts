/**
 * Adapter para Diário Oficial (DOU, DJE estaduais, DJE federais).
 *
 * Eventos relevantes: publicações que mencionem OAB, partes, CNPJ, palavras-chave.
 * Sem secretRef: opera apenas em modo mock (fixtures determinísticos por config).
 */

import { IntegrationProvider } from "@prisma/client";
import type {
  IntegrationAdapter,
  IntegrationContext,
  IntegrationEvent,
  IntegrationHealth,
  FetchEventsArgs,
} from "./types";
import { fingerprintOf } from "./fingerprint";

type DiarioConfig = {
  /** Termos monitorados (OAB, nome do escritório, CNPJ, processos). */
  watchTerms?: string[];
  /** Cadernos: DOU, DJE-SP, DJE-RJ, DJF1... */
  sections?: string[];
  mode?: "live" | "mock";
};

function readConfig(ctx: IntegrationContext): DiarioConfig {
  return (ctx.config as DiarioConfig | null) ?? {};
}

export const diarioOficialAdapter: IntegrationAdapter = {
  provider: IntegrationProvider.DIARIO_OFICIAL,

  async health(ctx: IntegrationContext): Promise<IntegrationHealth> {
    const cfg = readConfig(ctx);
    const checkedAt = new Date().toISOString();
    if (!cfg.watchTerms?.length) {
      return {
        ok: false,
        message: "Configure ao menos um termo de monitoramento (OAB, CNPJ, processo).",
        code: "INVALID_CONFIG",
        checkedAt,
      };
    }
    return {
      ok: true,
      message: `Monitorando ${cfg.watchTerms.length} termos em ${cfg.sections?.length ?? 0} cadernos.`,
      code: "READY",
      checkedAt,
    };
  },

  async fetchEvents(
    ctx: IntegrationContext,
    args: FetchEventsArgs,
  ): Promise<IntegrationEvent[]> {
    const cfg = readConfig(ctx);
    if ((cfg.mode ?? "mock") !== "mock") return [];
    const terms = cfg.watchTerms ?? [];
    const sections = cfg.sections?.length ? cfg.sections : ["DOU"];
    const limit = Math.max(1, Math.min(50, args.limit ?? 5));
    const today = new Date();
    today.setUTCHours(8, 0, 0, 0);
    const out: IntegrationEvent[] = [];
    for (let i = 0; i < terms.length; i++) {
      if (out.length >= limit) break;
      const term = terms[i]!;
      const section = sections[i % sections.length]!;
      const occurredAt = new Date(today.getTime() - i * 86_400_000).toISOString();
      if (args.since && occurredAt <= args.since) continue;
      out.push({
        fingerprint: fingerprintOf([IntegrationProvider.DIARIO_OFICIAL, term, section, occurredAt]),
        provider: IntegrationProvider.DIARIO_OFICIAL,
        kind: "PUBLICATION",
        title: `Publicação ${section} mencionando "${term}"`,
        body: `Texto de publicação envolvendo o termo monitorado "${term}". Verifique o caderno ${section}.`,
        occurredAt,
        payload: { term, section },
      });
    }
    return out;
  },
};
