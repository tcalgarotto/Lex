/**
 * GET /api/settings/justos/payment/pix — QR Code Pix embutido (sem redirect Asaas).
 */

import { NextResponse } from "next/server";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getPaymentPixQrCode } from "@/lib/billing/asaas/embedded-payment";
import { AsaasApiError } from "@/lib/billing/asaas/client";
import { resolvePendingJustosPayment } from "@/lib/justos/pending-payment";

export async function GET() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "billingManage")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const pending = await resolvePendingJustosPayment(workspaceId);
  if (!pending) {
    return NextResponse.json({ error: "Nenhuma cobrança pendente." }, { status: 404 });
  }

  try {
    const qr = await getPaymentPixQrCode(pending.paymentId);
    return NextResponse.json({
      ok: true,
      paymentId: pending.paymentId,
      encodedImage: qr.encodedImage,
      payload: qr.payload,
      expirationDate: qr.expirationDate,
    });
  } catch (e) {
    const msg =
      e instanceof AsaasApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Erro ao obter QR Code Pix.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
