"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  initialEnabled: boolean;
  initialProEnabled: boolean;
};

export function JustosWorkspaceForm({ initialEnabled, initialProEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [proEnabled, setProEnabled] = useState(initialProEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: { enabled?: boolean; proEnabled?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/justos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        error?: string;
        config?: { enabled: boolean; proEnabled: boolean };
      };
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar");
        return;
      }
      if (data.config) {
        setEnabled(data.config.enabled);
        setProEnabled(data.config.proEnabled);
      }
      router.refresh();
    } catch {
      setError("Erro de rede ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">JustOS (base)</p>
          <p className="text-xs text-muted-foreground">
            Envia eventos do JustOS para o n8n.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "default" : "outline"}>
            {enabled ? "Ativo" : "Desligado"}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant={enabled ? "outline" : "default"}
            disabled={saving}
            onClick={() => void save({ enabled: !enabled, proEnabled: !enabled ? false : proEnabled })}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">JustOS Pro</p>
          <p className="text-xs text-muted-foreground">
            Secretária proativa (WhatsApp, lembretes).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={proEnabled ? "default" : "secondary"}>
            {proEnabled ? "Pro ativo" : "Pro off"}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || !enabled}
            onClick={() => void save({ proEnabled: !proEnabled })}
          >
            {proEnabled ? "Desligar Pro" : "Ativar Pro"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
