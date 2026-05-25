/**
 * POST /api/settings/justos/payment/card — paga cobrança pendente com cartão na plataforma.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { payPaymentWithCreditCard } from "@/lib/billing/asaas/embedded-payment";
import { AsaasApiError } from "@/lib/billing/asaas/client";
import {
  JustosCreditCardPayBody,
  readClientRemoteIp,
} from "@/lib/billing/asaas/credit-card-schema";
import { activateJustosProFromAsaasPayment } from "@/lib/justos/asaas-payment-sync";
import { resolvePendingJustosPayment } from "@/lib/justos/pending-payment";

export async function POST(req: Request) {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "billingManage")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: ReturnType<typeof JustosCreditCardPayBody.parse>;
  try {
    body = JustosCreditCardPayBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Dados do cartão inválidos.", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const pending = await resolvePendingJustosPayment(workspaceId);
  if (!pending) {
    return NextResponse.json({ error: "Nenhuma cobrança pendente." }, { status: 404 });
  }

  const cpf = body.holderCpfCnpj.replace(/\D/g, "");
  const postal = body.postalCode.replace(/\D/g, "").slice(0, 8);
  const phoneDigits = body.phone.replace(/\D/g, "");
  const mobilePhone =
    phoneDigits.length >= 11 ? phoneDigits.slice(-11) : phoneDigits.padStart(11, "0").slice(-11);

  try {
    const payment = await payPaymentWithCreditCard({
      paymentId: pending.paymentId,
      remoteIp: readClientRemoteIp(req),
      creditCard: {
        holderName: body.holderName.trim(),
        number: body.number.replace(/\D/g, ""),
        expiryMonth: body.expiryMonth.padStart(2, "0"),
        expiryYear: body.expiryYear,
        ccv: body.ccv,
      },
      creditCardHolderInfo: {
        name: body.holderName.trim(),
        email: body.holderEmail.trim(),
        cpfCnpj: cpf,
        postalCode: postal,
        addressNumber: body.addressNumber.replace(/\D/g, "").slice(0, 10) || body.addressNumber.trim(),
        addressComplement: body.addressComplement?.trim() || null,
        phone: phoneDigits,
        mobilePhone,
      },
    });

    let message =
      payment.status === "CONFIRMED" || payment.status === "RECEIVED"
        ? "Pagamento confirmado."
        : "Pagamento em processamento. Aguarde a confirmação.";

    const activation = await activateJustosProFromAsaasPayment(workspaceId, payment);
    if (activation.activated) {
      message = activation.message;
    } else if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
      message += " Atualize a página em alguns segundos.";
    }

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      status: payment.status,
      activated: activation.activated,
      message,
    });
  } catch (e) {
    const msg =
      e instanceof AsaasApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Não foi possível processar o cartão.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
