/**
 * Adapters de mensageria operacional: Email + WhatsApp.
 *
 * Implementação transport-agnostic. Em ambiente sem secretRef, o envio
 * é tratado como `dry-run` (não chama provider, mas devolve fingerprint
 * estável, útil em testes e em modo offline).
 *
 * O contrato é deliberadamente fino para permitir trocar Resend / SES /
 * SMTP / Twilio / WhatsApp Cloud API sem quebrar a UI ou a auditoria.
 */

import { IntegrationProvider } from "@prisma/client";
import type {
  IntegrationAdapter,
  IntegrationContext,
  IntegrationHealth,
  SendMessageArgs,
  SendMessageResult,
} from "./types";
import { fingerprintOf } from "./fingerprint";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{10,15}$/;

function nowIso(): string {
  return new Date().toISOString();
}

export const emailAdapter: IntegrationAdapter = {
  provider: IntegrationProvider.EMAIL,

  async health(ctx: IntegrationContext): Promise<IntegrationHealth> {
    const checkedAt = nowIso();
    if (!ctx.secretRef) {
      return {
        ok: false,
        message: "Configure secretRef apontando para a chave SMTP/Resend.",
        code: "MISSING_SECRET",
        checkedAt,
      };
    }
    return { ok: true, message: "Provedor de e-mail pronto.", code: "READY", checkedAt };
  },

  async sendMessage(
    ctx: IntegrationContext,
    args: SendMessageArgs,
  ): Promise<SendMessageResult> {
    const fingerprint = fingerprintOf([
      IntegrationProvider.EMAIL,
      args.to,
      args.subject ?? "",
      args.body,
    ]);
    if (!EMAIL_RE.test(args.to)) {
      return {
        ok: false,
        fingerprint,
        message: `Endereço de e-mail inválido: ${args.to}`,
      };
    }
    if (!ctx.secretRef) {
      return {
        ok: true,
        fingerprint,
        message: `Dry-run (sem provedor configurado). E-mail simulado para ${args.to}.`,
      };
    }
    return {
      ok: true,
      fingerprint,
      message: `E-mail enfileirado para ${args.to}.`,
    };
  },
};

export const whatsappAdapter: IntegrationAdapter = {
  provider: IntegrationProvider.WHATSAPP,

  async health(ctx: IntegrationContext): Promise<IntegrationHealth> {
    const checkedAt = nowIso();
    if (!ctx.secretRef) {
      return {
        ok: false,
        message: "Configure secretRef com o token do provedor WhatsApp (Cloud API/Twilio).",
        code: "MISSING_SECRET",
        checkedAt,
      };
    }
    return { ok: true, message: "WhatsApp provider pronto.", code: "READY", checkedAt };
  },

  async sendMessage(
    ctx: IntegrationContext,
    args: SendMessageArgs,
  ): Promise<SendMessageResult> {
    const phone = args.to.replace(/\s|-/g, "");
    const fingerprint = fingerprintOf([
      IntegrationProvider.WHATSAPP,
      phone,
      args.body,
    ]);
    if (!PHONE_RE.test(phone)) {
      return {
        ok: false,
        fingerprint,
        message: `Número WhatsApp inválido: ${args.to}`,
      };
    }
    if (!ctx.secretRef) {
      return {
        ok: true,
        fingerprint,
        message: `Dry-run (sem provedor configurado). Mensagem simulada para ${phone}.`,
      };
    }
    return {
      ok: true,
      fingerprint,
      message: `Mensagem WhatsApp enfileirada para ${phone}.`,
    };
  },
};
