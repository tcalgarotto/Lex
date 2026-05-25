/**
 * POST /api/settings/justos/payment/sync — consulta Asaas e ativa Pro se cobrança paga.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { syncJustosPaymentFromAsaas } from "@/lib/justos/asaas-payment-sync";
import { resolvePendingJustosPayment } from "@/lib/justos/pending-payment";
import { readAsaasApiBaseUrl } from "@/lib/billing/asaas/client";

export async function POST() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "billingManage")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const pending = await resolvePendingJustosPayment(workspaceId);
  if (!pending) {
    return NextResponse.json({ error: "Nenhuma cobrança pendente." }, { status: 404 });
  }

  const result = await syncJustosPaymentFromAsaas(workspaceId, pending.paymentId);
  const sandbox = readAsaasApiBaseUrl().includes("sandbox");

  return NextResponse.json({
    ok: true,
    activated: result.activated,
    status: result.status,
    message: result.message,
    sandboxHint: sandbox && !result.activated
      ? 'No Sandbox, abra a cobrança no Asaas e clique em "Confirmar pagamento" (Pix real do banco não confirma sozinho).'
      : undefined,
  });
}
