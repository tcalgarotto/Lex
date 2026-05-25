"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PixState = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};

type Props = {
  paymentId: string | null;
  defaultCpf?: string;
  defaultEmail?: string;
  defaultName?: string;
  defaultPhone?: string;
  isSandbox?: boolean;
};

export function JustosProPaymentPanel({
  paymentId,
  defaultCpf = "",
  defaultEmail = "",
  defaultName = "",
  defaultPhone = "",
  isSandbox = true,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"pix" | "card">("pix");
  const [pix, setPix] = useState<PixState | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardOk, setCardOk] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [holderName, setHolderName] = useState(defaultName);
  const [holderEmail, setHolderEmail] = useState(defaultEmail);
  const [holderCpf, setHolderCpf] = useState(defaultCpf);
  const [number, setNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [ccv, setCcv] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadPix = useCallback(async () => {
    if (!paymentId) return;
    setPixLoading(true);
    setPixError(null);
    try {
      const res = await fetch("/api/settings/justos/payment/pix");
      const data = (await res.json()) as PixState & { error?: string };
      if (!res.ok) {
        setPixError(data.error ?? "Não foi possível carregar o Pix.");
        setPix(null);
        return;
      }
      setPix({
        encodedImage: data.encodedImage,
        payload: data.payload,
        expirationDate: data.expirationDate,
      });
    } catch {
      setPixError("Erro de rede ao carregar Pix.");
    } finally {
      setPixLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (tab === "pix" && paymentId && !pix && !pixLoading) {
      void loadPix();
    }
  }, [tab, paymentId, pix, pixLoading, loadPix]);

  async function payCard() {
    setCardLoading(true);
    setCardError(null);
    setCardOk(null);
    try {
      const res = await fetch("/api/settings/justos/payment/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderName,
          number,
          expiryMonth,
          expiryYear,
          ccv,
          holderEmail,
          holderCpfCnpj: holderCpf,
          postalCode,
          addressNumber,
          phone,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        detail?: string;
        activated?: boolean;
      };
      if (!res.ok) {
        setCardError(data.error ?? data.detail ?? "Pagamento recusado.");
        return;
      }
      setCardOk(data.message ?? "Pagamento enviado.");
      if (data.activated) router.refresh();
    } catch {
      setCardError("Erro de rede.");
    } finally {
      setCardLoading(false);
    }
  }

  async function syncPaymentStatus() {
    setSyncLoading(true);
    setSyncMsg(null);
    setPixError(null);
    try {
      const res = await fetch("/api/settings/justos/payment/sync", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        sandboxHint?: string;
        activated?: boolean;
        status?: string;
      };
      if (!res.ok) {
        setSyncMsg(data.error ?? "Não foi possível verificar o pagamento.");
        return;
      }
      const parts = [data.message, data.sandboxHint].filter(Boolean);
      setSyncMsg(parts.join(" "));
      if (data.activated) router.refresh();
    } catch {
      setSyncMsg("Erro de rede ao sincronizar.");
    } finally {
      setSyncLoading(false);
    }
  }

  async function copyPayload() {
    if (!pix?.payload) return;
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setPixError("Não foi possível copiar o código Pix.");
    }
  }

  if (!paymentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Aguardando cobrança. Se demorar, use &quot;Gerar nova cobrança&quot;.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-4">
      <p className="mb-3 text-sm font-medium">Pagamento na plataforma</p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "pix" | "card")}>
        <TabsList className="w-full">
          <TabsTrigger value="pix" className="flex-1">
            Pix
          </TabsTrigger>
          <TabsTrigger value="card" className="flex-1">
            Cartão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pix" className="mt-4 space-y-3">
          {isSandbox ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <strong>Sandbox:</strong> Pix pelo app do banco em geral{" "}
              <strong>não confirma</strong> aqui. No painel Asaas da cobrança, use{" "}
              <strong>Confirmar pagamento</strong> — depois clique em &quot;Verificar pagamento&quot;
              abaixo.
            </p>
          ) : null}
          {pixError ? <p className="text-sm text-destructive">{pixError}</p> : null}
          {pixLoading ? (
            <p className="text-sm text-muted-foreground">Gerando QR Code…</p>
          ) : null}
          {pix?.encodedImage ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  pix.encodedImage.startsWith("data:")
                    ? pix.encodedImage
                    : `data:image/png;base64,${pix.encodedImage}`
                }
                alt="QR Code Pix"
                className="size-48 rounded-md bg-white p-2"
              />
              <p className="text-xs text-muted-foreground">
                Válido até{" "}
                {new Date(pix.expirationDate).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPayload()}>
                <Copy className="mr-2 size-4" />
                {copied ? "Copiado!" : "Copiar Pix copia e cola"}
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pixLoading}
            onClick={() => void loadPix()}
          >
            <RefreshCw className="mr-2 size-4" />
            Atualizar QR
          </Button>
          {syncMsg ? <p className="text-sm text-muted-foreground">{syncMsg}</p> : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={syncLoading}
            onClick={() => void syncPaymentStatus()}
          >
            {syncLoading ? "Verificando…" : "Verificar pagamento no Asaas"}
          </Button>
        </TabsContent>

        <TabsContent value="card" className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cc-name">Nome no cartão</Label>
              <Input
                id="cc-name"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                autoComplete="cc-name"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cc-number">Número</Label>
              <Input
                id="cc-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-exp-m">Mês</Label>
              <Input
                id="cc-exp-m"
                placeholder="MM"
                value={expiryMonth}
                onChange={(e) => setExpiryMonth(e.target.value)}
                autoComplete="cc-exp-month"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-exp-y">Ano</Label>
              <Input
                id="cc-exp-y"
                placeholder="AAAA"
                value={expiryYear}
                onChange={(e) => setExpiryYear(e.target.value)}
                autoComplete="cc-exp-year"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-cvv">CVV</Label>
              <Input
                id="cc-cvv"
                value={ccv}
                onChange={(e) => setCcv(e.target.value)}
                inputMode="numeric"
                autoComplete="cc-csc"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-cpf">CPF/CNPJ</Label>
              <Input
                id="cc-cpf"
                value={holderCpf}
                onChange={(e) => setHolderCpf(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cc-email">E-mail</Label>
              <Input
                id="cc-email"
                type="email"
                value={holderEmail}
                onChange={(e) => setHolderEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-cep">CEP</Label>
              <Input
                id="cc-cep"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-num">Nº endereço (só o número)</Label>
              <Input
                id="cc-num"
                placeholder="316"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cc-phone">Celular com DDD</Label>
              <Input
                id="cc-phone"
                placeholder="47999998888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>
          {cardError ? <p className="text-sm text-destructive">{cardError}</p> : null}
          {cardOk ? <p className="text-sm text-emerald-600">{cardOk}</p> : null}
          <Button
            type="button"
            className="w-full"
            disabled={cardLoading}
            onClick={() => void payCard()}
          >
            {cardLoading ? "Processando…" : "Pagar com cartão"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Sandbox: cartão aprovado{" "}
            <span className="font-mono">5162306219378829</span> —{" "}
            <a
              href="https://docs.asaas.com/docs/testing-credit-card-payment"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              documentação Asaas
            </a>
            .
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
