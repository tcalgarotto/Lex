/**
 * Adapters de tribunal (PJe, e-SAJ, Projudi, EPROC).
 *
 * Cada plataforma tem semântica diferente de movimentação processual,
 * mas a saída é normalizada em `IntegrationEvent` p/ a timeline viva.
 *
 * Sem credenciais (secretRef ausente) o adapter NÃO faz chamadas externas,
 * apenas reporta health e (em modo `mock`) gera eventos determinísticos
 * para que o sistema possa ser testado fim-a-fim.
 */

import { IntegrationProvider } from "@prisma/client";
import {
  IntegrationAdapter,
  IntegrationContext,
  IntegrationError,
  IntegrationEvent,
  IntegrationHealth,
  FetchEventsArgs,
} from "./types";
import { fingerprintOf } from "./fingerprint";

type TribunalConfig = {
  /** Lista de processos monitorados (CNJ). */
  processes?: string[];
  /** Sigla do tribunal alvo (TJSP, TRF3...). */
  tribunalCode?: string;
  /** UF (SP, RJ...). */
  uf?: string;
  /** Modo: `live` exige secretRef; `mock` retorna fixtures determinísticos. */
  mode?: "live" | "mock";
};

function readConfig(ctx: IntegrationContext): TribunalConfig {
  return (ctx.config as TribunalConfig | null) ?? {};
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildMockEvents(
  provider: IntegrationProvider,
  cfg: TribunalConfig,
  args: FetchEventsArgs,
): IntegrationEvent[] {
  const processes = cfg.processes ?? [];
  if (!processes.length) return [];
  const limit = Math.max(1, Math.min(50, args.limit ?? 5));
  const baseDate = new Date();
  baseDate.setUTCHours(12, 0, 0, 0);
  const out: IntegrationEvent[] = [];
  for (let i = 0; i < processes.length && out.length < limit; i++) {
    const pn = processes[i]!;
    const occurredAt = new Date(baseDate.getTime() - i * 86_400_000).toISOString();
    if (args.since && occurredAt <= args.since) continue;
    const fingerprint = fingerprintOf([provider, pn, occurredAt]);
    out.push({
      fingerprint,
      provider,
      kind: "PROCESS_MOVEMENT",
      title: `Movimentação no processo ${pn}`,
      body:
        provider === "PJE"
          ? "Juntada de petição intercorrente. Sem prazo associado nesta movimentação."
          : provider === "ESAJ"
            ? "Decisão proferida nos autos. Verificar conteúdo no e-SAJ."
            : provider === "PROJUDI"
              ? "Despacho — vista à parte adversa por 5 dias."
              : "Manifestação juntada no EPROC.",
      occurredAt,
      caseRef: {
        processNumber: pn,
        tribunalCode: cfg.tribunalCode ?? null,
        uf: cfg.uf ?? null,
      },
      payload: { processNumber: pn, source: provider },
    });
  }
  return out;
}

class TribunalAdapter implements IntegrationAdapter {
  constructor(public readonly provider: IntegrationProvider) {}

  async health(ctx: IntegrationContext): Promise<IntegrationHealth> {
    const cfg = readConfig(ctx);
    const checkedAt = nowIso();
    if ((cfg.mode ?? "live") === "mock") {
      return {
        ok: true,
        message: `${this.provider} em modo mock — sem chamadas externas.`,
        code: "MOCK_OK",
        checkedAt,
      };
    }
    if (!ctx.secretRef) {
      return {
        ok: false,
        message: `Credenciais ausentes para ${this.provider}. Configure secretRef.`,
        code: "MISSING_SECRET",
        checkedAt,
      };
    }
    if (!cfg.processes?.length) {
      return {
        ok: true,
        message: `${this.provider} configurado, mas sem processos para monitorar.`,
        code: "NO_PROCESSES",
        checkedAt,
      };
    }
    return {
      ok: true,
      message: `${this.provider} pronto para sincronizar (${cfg.processes.length} processos).`,
      code: "READY",
      checkedAt,
    };
  }

  async fetchEvents(
    ctx: IntegrationContext,
    args: FetchEventsArgs,
  ): Promise<IntegrationEvent[]> {
    const cfg = readConfig(ctx);
    const mode = cfg.mode ?? "live";
    if (mode === "mock") return buildMockEvents(this.provider, cfg, args);
    if (!ctx.secretRef) {
      throw new IntegrationError(
        "MISSING_SECRET",
        `Credenciais ausentes para ${this.provider}.`,
      );
    }
    return [];
  }
}

export const pjeAdapter: IntegrationAdapter = new TribunalAdapter(IntegrationProvider.PJE);
export const esajAdapter: IntegrationAdapter = new TribunalAdapter(IntegrationProvider.ESAJ);
export const projudiAdapter: IntegrationAdapter = new TribunalAdapter(IntegrationProvider.PROJUDI);
export const eprocAdapter: IntegrationAdapter = new TribunalAdapter(IntegrationProvider.EPROC);
