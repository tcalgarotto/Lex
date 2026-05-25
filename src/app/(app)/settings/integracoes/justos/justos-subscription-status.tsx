"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JustosProPaymentPanel } from "@/components/justos/justos-pro-payment-panel";
import {
  formatJustosPriceBrl,
  JUSTOS_PRO_NAME,
  JUSTOS_PRO_PRICE_MONTHLY_BRL,
  JUSTOS_PRO_PRICE_YEARLY_BRL,
} from "@/lib/justos";
import type { JustosProBillingCycle } from "@/lib/justos";

type Props = {
  isOwner: boolean;
  proActive: boolean;
  billingCycle?: JustosProBillingCycle;
  subscribedAt?: string;
  renewsAt?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  accessUntil?: string;
  paymentId?: string | null;
  pendingPayment?: boolean;
  ownerEmail?: string;
  ownerName?: string;
  sandboxCpf?: string;
  ownerPhone?: string;
  isSandbox?: boolean;
};

export function JustosSubscriptionStatus({
  isOwner,
  proActive,
  billingCycle,
  subscribedAt,
  renewsAt,
  status,
  cancelAtPeriodEnd,
  accessUntil,
  paymentId,
  pendingPayment,
  ownerEmail = "",
  ownerName = "",
  sandboxCpf = "",
  ownerPhone = "",
  isSandbox = true,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!proActive && !pendingPayment) return null;

  const priceLabel =
    billingCycle === "yearly"
      ? `${formatJustosPriceBrl(JUSTOS_PRO_PRICE_YEARLY_BRL)}/ano`
      : `${formatJustosPriceBrl(JUSTOS_PRO_PRICE_MONTHLY_BRL)}/mês`;

  const accessLabel = accessUntil
    ? new Date(accessUntil).toLocaleDateString("pt-BR")
    : renewsAt
      ? new Date(renewsAt).toLocaleDateString("pt-BR")
      : null;

  async function cancel() {
    const untilHint = accessLabel ? ` Você mantém acesso até ${accessLabel}.` : "";
    if (
      !confirm(
        `Cancelar renovação do JustOS Pro?${untilHint} Não haverá nova cobrança após essa data.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/justos/subscribe", { method: "DELETE" });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Falha ao cancelar.");
        return;
      }
      if (data.message) setError(null);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {pendingPayment && !proActive
              ? `${JUSTOS_PRO_NAME} — pagamento pendente`
              : `${JUSTOS_PRO_NAME} contratado`}
          </p>
          <p className="text-xs text-muted-foreground">{priceLabel}</p>
        </div>
        <Badge variant={pendingPayment ? "secondary" : cancelAtPeriodEnd ? "outline" : "default"}>
          {pendingPayment
            ? "Aguardando pagamento"
            : cancelAtPeriodEnd
              ? "Cancela ao fim do período"
              : status === "past_due"
                ? "Em atraso"
                : status === "active"
                  ? "Ativo"
                  : "Pro"}
        </Badge>
      </div>

      {pendingPayment && paymentId && proActive ? (
        <JustosProPaymentPanel
          paymentId={paymentId}
          defaultEmail={ownerEmail}
          defaultName={ownerName}
          defaultCpf={sandboxCpf}
          defaultPhone={ownerPhone}
          isSandbox={isSandbox}
        />
      ) : null}

      {subscribedAt ? (
        <p className="text-xs text-muted-foreground">
          Desde {new Date(subscribedAt).toLocaleDateString("pt-BR")}
          {cancelAtPeriodEnd && accessLabel
            ? ` · Acesso até ${accessLabel} (sem renovação)`
            : accessLabel
              ? ` · Próxima cobrança em ${accessLabel}`
              : null}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {isOwner && proActive && !cancelAtPeriodEnd ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void cancel()}
        >
          {loading ? "Cancelando…" : "Cancelar renovação"}
        </Button>
      ) : null}
    </div>
  );
}
