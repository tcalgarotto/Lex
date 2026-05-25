"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JustosProPaymentPanel } from "@/components/justos/justos-pro-payment-panel";
import {
  formatJustosPriceBrl,
  JUSTOS_PRO_FEATURES,
  JUSTOS_PRO_NAME,
  JUSTOS_PRO_PRICE_MONTHLY_BRL,
  JUSTOS_PRO_PRICE_YEARLY_BRL,
  JUSTOS_PRO_PRICING_NOTE,
  justosProYearlySavingsPercent,
} from "@/lib/justos";
import type { JustosProBillingCycle } from "@/lib/justos";

type Props = {
  isOwner: boolean;
  proActive: boolean;
  initialCycle?: JustosProBillingCycle;
  initialPaymentId?: string | null;
  pendingPayment?: boolean;
  ownerEmail?: string;
  ownerName?: string;
  sandboxCpf?: string;
  ownerPhone?: string;
  isSandbox?: boolean;
};

export function JustosPlanPicker({
  isOwner,
  proActive,
  initialCycle,
  initialPaymentId,
  pendingPayment: initialPending,
  ownerEmail = "",
  ownerName = "",
  sandboxCpf = "",
  ownerPhone = "",
  isSandbox = true,
}: Props) {
  const router = useRouter();
  const [cycle, setCycle] = useState<JustosProBillingCycle>(initialCycle ?? "yearly");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(initialPaymentId ?? null);
  const [pendingMsg, setPendingMsg] = useState<string | null>(
    initialPending ? "Conclua o pagamento abaixo para ativar o JustOS Pro." : null,
  );
  const [reusedPayment, setReusedPayment] = useState(false);
  const showPayment = Boolean(paymentId ?? initialPending);

  async function subscribe(forceNew = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/justos/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle, paymentMethod, forceNew }),
      });
      const data = (await res.json()) as {
        error?: string;
        paymentId?: string | null;
        message?: string;
        pendingPayment?: boolean;
        reused?: boolean;
      };
      if (!res.ok) {
        const msg =
          data.error === "cross-origin blocked"
            ? "Acesso bloqueado (origem LAN). Reinicie com ALLOWED_DEV_ORIGINS no .env ou use localhost:3000."
            : (data.error ?? "Não foi possível concluir a assinatura.");
        setError(msg);
        return;
      }
      setPaymentId(data.paymentId ?? null);
      setReusedPayment(Boolean(data.reused ?? data.message?.includes("pendente")));
      setPendingMsg(
        data.pendingPayment
          ? (data.message ?? "Conclua o pagamento abaixo.")
          : (data.message ?? null),
      );
      if (!data.pendingPayment) {
        router.refresh();
      }
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (proActive) return null;

  const price =
    cycle === "yearly" ? JUSTOS_PRO_PRICE_YEARLY_BRL : JUSTOS_PRO_PRICE_MONTHLY_BRL;
  const period = cycle === "yearly" ? "/ano" : "/mês";

  return (
    <Card className="ring-1 ring-[color:var(--brand-border)] shadow-[var(--shadow-violet)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={cycle === "monthly" ? "default" : "outline"}
            disabled={loading}
            onClick={() => setCycle("monthly")}
          >
            Mensal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={cycle === "yearly" ? "default" : "outline"}
            disabled={loading}
            onClick={() => setCycle("yearly")}
          >
            Anual
            <Badge variant="secondary" className="ml-2 text-[10px]">
              −{justosProYearlySavingsPercent()}%
            </Badge>
          </Button>
        </div>
        <CardTitle className="text-lg">{JUSTOS_PRO_NAME}</CardTitle>
        <p className="text-sm text-muted-foreground">{JUSTOS_PRO_PRICING_NOTE}</p>
        <div className="pt-1">
          <span className="text-3xl font-semibold">{formatJustosPriceBrl(price)}</span>
          <span className="text-muted-foreground">{period}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {JUSTOS_PRO_FEATURES.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-violet-400" />
            {f}
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        {!isOwner ? (
          <p className="text-sm text-muted-foreground">
            Apenas o titular do escritório pode assinar.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {pendingMsg ? <p className="text-sm text-muted-foreground">{pendingMsg}</p> : null}

        {showPayment ? (
          <JustosProPaymentPanel
            paymentId={paymentId ?? initialPaymentId ?? null}
            defaultEmail={ownerEmail}
            defaultName={ownerName}
            defaultCpf={sandboxCpf}
            defaultPhone={ownerPhone}
            isSandbox={isSandbox}
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Forma de pagamento da assinatura</p>
            <Tabs
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "pix" | "credit_card")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="pix" className="flex-1">
                  Pix
                </TabsTrigger>
                <TabsTrigger value="credit_card" className="flex-1">
                  Cartão
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={loading || !isOwner}
          onClick={() => void subscribe(false)}
        >
          {loading
            ? "Processando…"
            : showPayment
              ? "Atualizar assinatura"
              : `Assinar ${JUSTOS_PRO_NAME}`}
        </Button>
        {showPayment && isOwner ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => {
              if (
                !confirm(
                  "Isso cancela a assinatura pendente no Asaas e cria outra — pode gerar um segundo e-mail de cobrança. Prefira \"Verificar pagamento\" se já pagou. Continuar?",
                )
              ) {
                return;
              }
              void subscribe(true);
            }}
          >
            Recriar assinatura (último recurso)
          </Button>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          Pix e cartão são processados na plataforma via Asaas (sem redirecionamento).
        </p>
      </CardFooter>
    </Card>
  );
}
