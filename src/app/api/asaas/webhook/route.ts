/**
 * POST /api/asaas/webhook — eventos de cobrança/assinatura Asaas.
 * https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
 */

import { NextResponse } from "next/server";
import { claimAsaasBillingEvent } from "@/lib/billing/asaas/webhook-idempotency";
import { validateAsaasWebhookToken } from "@/lib/billing/asaas/webhook-auth";
import type { AsaasWebhookEvent } from "@/lib/billing/asaas/types";
import {
  applyAsaasWebhookToWorkspace,
  resolveWorkspaceIdFromAsaasEvent,
} from "@/lib/justos/asaas-billing-sync";

export async function POST(req: Request) {
  const traceId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const auth = validateAsaasWebhookToken(req.headers.get("asaas-access-token"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, traceId }, { status: 401 });
  }

  let body: AsaasWebhookEvent;
  try {
    body = (await req.json()) as AsaasWebhookEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido", traceId }, { status: 400 });
  }

  if (!body.event) {
    return NextResponse.json({ error: "event ausente", traceId }, { status: 400 });
  }

  const workspaceId = await resolveWorkspaceIdFromAsaasEvent(body);
  const claim = await claimAsaasBillingEvent({ event: body, workspaceId: workspaceId ?? undefined });
  if (claim.duplicate) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      eventId: claim.eventId,
      traceId,
    });
  }

  try {
    const result = await applyAsaasWebhookToWorkspace(body);
    return NextResponse.json({ traceId, eventId: claim.eventId, ...result });
  } catch (e) {
    console.error("[asaas/webhook]", traceId, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar webhook", traceId },
      { status: 500 },
    );
  }
}
