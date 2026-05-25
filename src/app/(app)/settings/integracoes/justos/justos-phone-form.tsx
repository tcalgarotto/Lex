"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialLawyerWhatsApp: string;
  initialOfficePhone: string;
  proActive: boolean;
  disabled?: boolean;
};

export function JustosPhoneForm({
  initialLawyerWhatsApp,
  initialOfficePhone,
  proActive,
  disabled,
}: Props) {
  const router = useRouter();
  const [lawyerWa, setLawyerWa] = useState(initialLawyerWhatsApp);
  const [officePhone, setOfficePhone] = useState(initialOfficePhone);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!lawyerWa.trim()) {
      setError("Informe o WhatsApp do advogado.");
      return;
    }
    if (!consent) {
      setError("Confirme o consentimento para receber mensagens operacionais.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/justos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lawyerWhatsApp: [lawyerWa.trim()],
          officePhone: officePhone.trim() || null,
          enabled: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        syncedCaseId?: string;
        syncedCaseIds?: string[];
      };
      if (!res.ok) {
        const msg =
          data.error === "cross-origin blocked"
            ? "Acesso bloqueado na rede local. Reinicie o dev server ou use localhost:3000."
            : (data.error ?? "Falha ao salvar");
        setError(msg);
        return;
      }
      const n = data.syncedCaseIds?.length ?? (data.syncedCaseId ? 1 : 0);
      setMessage(
        n > 0
          ? `Número autorizado e vinculado a ${n} caso(s) ativo(s) do escritório.`
          : "WhatsApp cadastrado no escritório.",
      );
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="justos-lawyer-wa">WhatsApp do advogado (notificações JustOS Pro)</Label>
        <Input
          id="justos-lawyer-wa"
          placeholder="5547999999999"
          value={lawyerWa}
          disabled={saving || disabled}
          onChange={(e) => setLawyerWa(e.target.value)}
          className="mt-1 max-w-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          DDI + DDD + número, só dígitos. Este número recebe avisos de minuta, revisão e casos parados.
        </p>
      </div>
      <div>
        <Label htmlFor="justos-office-phone">Telefone do escritório (opcional)</Label>
        <Input
          id="justos-office-phone"
          placeholder="5547999999999"
          value={officePhone}
          disabled={saving || disabled}
          onChange={(e) => setOfficePhone(e.target.value)}
          className="mt-1 max-w-sm"
        />
      </div>
      <label className="flex max-w-lg cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          disabled={saving || disabled}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-muted-foreground">
          Autorizo o JustOS a enviar mensagens operacionais para este WhatsApp, vinculadas aos
          casos deste escritório, conforme a política de privacidade do JustOS.
        </span>
      </label>
      {!proActive ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Assine o JustOS Pro acima para ativar notificações WhatsApp.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button
        type="button"
        size="sm"
        disabled={saving || disabled || !proActive}
        onClick={() => void save()}
      >
        {saving ? "Salvando…" : "Cadastrar e autorizar número"}
      </Button>
    </div>
  );
}
