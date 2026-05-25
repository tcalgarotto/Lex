"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CrmContactForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!displayName.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          phoneE164: phoneE164.trim() || null,
          email: email.trim() || null,
          kind: "CLIENT",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar contato");
        return;
      }
      setDisplayName("");
      setPhoneE164("");
      setEmail("");
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Novo contato</p>
      <div>
        <Label htmlFor="crm-name">Nome</Label>
        <Input
          id="crm-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 max-w-md"
        />
      </div>
      <div>
        <Label htmlFor="crm-phone">WhatsApp / telefone (E.164)</Label>
        <Input
          id="crm-phone"
          placeholder="5547999999999"
          value={phoneE164}
          onChange={(e) => setPhoneE164(e.target.value)}
          className="mt-1 max-w-md"
        />
      </div>
      <div>
        <Label htmlFor="crm-email">E-mail</Label>
        <Input
          id="crm-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 max-w-md"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>
        {saving ? "Salvando…" : "Adicionar contato"}
      </Button>
    </div>
  );
}
