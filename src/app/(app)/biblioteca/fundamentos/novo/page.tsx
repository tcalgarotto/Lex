"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function NewFoundationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [optInRag, setOptInRag] = useState(false);
  const [optInMemory, setOptInMemory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/library/foundations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          contentMd,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          optInRag,
          optInMemory,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar.");
      router.push(`/biblioteca/fundamentos/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Novo fundamento">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Novo fundamento</h1>
          <p className="text-sm text-muted-foreground">
            Salve um fundamento reutilizável do escritório. Por padrão, ele não entra em RAG/memória sem opt-in.
          </p>
        </header>

        <Card className="space-y-4 p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Direito à saúde — medicamento de alto custo" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (separadas por vírgula)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="saúde, urgência, sus" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Conteúdo (Markdown)</label>
            <Textarea value={contentMd} onChange={(e) => setContentMd(e.target.value)} rows={12} placeholder="Cole aqui o texto do fundamento, com citações humanas quando aplicável." />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={optInRag ? "default" : "outline"} onClick={() => setOptInRag((v) => !v)}>
              {optInRag ? "RAG: ativado" : "RAG: desativado"}
            </Button>
            <Button type="button" variant={optInMemory ? "default" : "outline"} onClick={() => setOptInMemory((v) => !v)}>
              {optInMemory ? "Memória: ativada" : "Memória: desativada"}
            </Button>
            <Badge variant="secondary">Opt-in obrigatório</Badge>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/biblioteca")}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={saving || title.trim().length < 3 || contentMd.trim().length < 10}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

