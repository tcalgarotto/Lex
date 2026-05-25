import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { AsaasWebhookEvent } from "./types";

export function hashAsaasWebhookPayload(event: AsaasWebhookEvent): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

export function deriveAsaasEventId(event: AsaasWebhookEvent): string {
  const paymentId = event.payment?.id;
  const subId = event.subscription?.id;
  if (paymentId) return `${event.event}:${paymentId}`;
  if (subId) return `${event.event}:${subId}`;
  return `${event.event}:${hashAsaasWebhookPayload(event).slice(0, 32)}`;
}

/** Retorna true se já processado (duplicata). */
export async function claimAsaasBillingEvent(args: {
  event: AsaasWebhookEvent;
  workspaceId?: string;
}): Promise<{ duplicate: boolean; eventId: string }> {
  const eventId = deriveAsaasEventId(args.event);
  const rawHash = hashAsaasWebhookPayload(args.event);

  try {
    await prisma.justosBillingEvent.create({
      data: {
        provider: "asaas",
        eventId,
        eventType: args.event.event,
        workspaceId: args.workspaceId,
        rawHash,
      },
    });
    return { duplicate: false, eventId };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return { duplicate: true, eventId };
    throw e;
  }
}
