"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const SAMPLE = `Autora: Maria Souza 111.222.333-44
Réu: Empresa ABC Ltda

A autora celebrou contrato de prestação de serviços com a ré em 12/03/2022. Em 05/05/2023 a ré deixou de prestar o serviço contratado, causando prejuízo material e abalo emocional.

Requer a rescisão contratual e a condenação ao ressarcimento de R$ 12.500,00 a título de danos materiais. Pleiteia tutela de urgência para imediata suspensão da cobrança.`;

export default function NewCasePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    if (text.trim().length < 20) {
      setError("Descreva o caso com pelo menos 20 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawInput: text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `falha ${res.status}`);
      }
      const json = (await res.json()) as { case: { id: string } };
      router.push(`/cases/${json.case.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Novo caso">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5" /> Intake jurídico inteligente
          </div>
          <h1 className="text-2xl font-semibold">Novo caso</h1>
          <p className="text-sm text-muted-foreground">
            Cole o relato bruto. O Lex extrai <strong>partes</strong>, <strong>fatos</strong>,{" "}
            <strong>pedidos</strong>, identifica <strong>tribunal</strong> e cria a base estratégica do caso —
            tudo determinístico, auditável e isolado por workspace.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["Determinístico", "Multi-tenant", "Auditável", "PII-safe"].map((b) => (
              <Badge key={b} variant="outline" className="text-[10px] uppercase tracking-wide">
                {b}
              </Badge>
            ))}
          </div>
        </header>

        <Card className="p-4 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={SAMPLE}
            className="min-h-[260px] font-mono text-[13px] leading-relaxed"
            data-testid="case-raw-input"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setText(SAMPLE)}
              className="text-xs"
              type="button"
            >
              <Wand2 className="mr-1 size-3" /> Carregar exemplo
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{text.length} caracteres</span>
              <Button onClick={submit} disabled={loading} data-testid="case-submit">
                {loading ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-4" />
                )}
                Iniciar caso
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </Card>

        <Card className="p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Sobre o intake:</strong> tudo aqui é processado deterministicamente
            (regex + heurísticas linguísticas) — nada de LLM no caminho crítico. O resultado é uma estrutura
            jurídica auditável, depois enriquecida pelo retrieval e pelas camadas de raciocínio.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
