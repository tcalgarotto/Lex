"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OfficeMemoryScope } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CaseOption = { id: string; title: string };

export type OfficeMemoryRow = {
  id: string;
  scope: OfficeMemoryScope;
  caseId: string | null;
  ownerUserId: string | null;
  title: string;
  private: boolean;
  useAsModel: boolean;
  useAsStyle: boolean;
  optInRag: boolean;
  originType: string | null;
  originId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  case: { id: string; title: string } | null;
};

export function OfficeMemoryPanel(props: { initialMemories: OfficeMemoryRow[]; cases: CaseOption[] }) {
  const router = useRouter();
  const [memories, setMemories] = useState(props.initialMemories);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [scope, setScope] = useState<OfficeMemoryScope>("WORKSPACE");
  const [caseId, setCaseId] = useState<string>("");
  const [privateMem, setPrivateMem] = useState(false);
  const [useAsModel, setUseAsModel] = useState(false);
  const [useAsStyle, setUseAsStyle] = useState(false);
  const [optInRag, setOptInRag] = useState(false);

  const caseOptions = useMemo(
    () => props.cases.map((c) => ({ value: c.id, label: c.title || "Sem título" })),
    [props.cases],
  );

  const selectClass = cn(
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  );

  async function refresh() {
    const res = await fetch("/api/office-memory?archived=1", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { memories: OfficeMemoryRow[] };
    setMemories(j.memories);
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("create");
    try {
      const res = await fetch("/api/office-memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contentMd: contentMd.trim(),
          scope,
          caseId: scope === "CASE" ? caseId || undefined : undefined,
          private: privateMem,
          useAsModel,
          useAsStyle,
          optInRag,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setTitle("");
      setContentMd("");
      setPrivateMem(false);
      setUseAsModel(false);
      setUseAsStyle(false);
      setOptInRag(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/office-memory/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover esta memória?")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/office-memory/${id}?confirm=1`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <Card className="border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">{error}</Card>
      ) : null}

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Nova memória (opt-in)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Nada é criado automaticamente a partir de casos ou chats. Flags de modelo, estilo e RAG só valem se você
          marcar explicitamente.
        </p>
        <form className="mt-4 space-y-3" onSubmit={create}>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Escopo</Label>
              <select
                className={selectClass}
                value={scope}
                onChange={(e) => setScope(e.target.value as OfficeMemoryScope)}
              >
                <option value="WORKSPACE">Escritório (workspace)</option>
                <option value="USER">Pessoal (só você)</option>
                <option value="CASE">Caso específico</option>
              </select>
            </div>
          </div>
          {scope === "CASE" ? (
            <div className="space-y-1">
              <Label className="text-xs">Caso</Label>
              <select className={selectClass} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">Selecione…</option>
                {caseOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs">Conteúdo (Markdown)</Label>
            <Textarea value={contentMd} onChange={(e) => setContentMd(e.target.value)} rows={5} required minLength={4} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={privateMem} onChange={(e) => setPrivateMem(e.target.checked)} />
              Privada (só quem criou vê)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useAsModel} onChange={(e) => setUseAsModel(e.target.checked)} />
              Usar como modelo de peça
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useAsStyle} onChange={(e) => setUseAsStyle(e.target.checked)} />
              Referência de estilo
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={optInRag} onChange={(e) => setOptInRag(e.target.checked)} />
              Opt-in RAG (quando suportado)
            </label>
          </div>
          <Button type="submit" disabled={busy === "create"}>
            Salvar memória
          </Button>
        </form>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Memórias visíveis para você ({memories.length})</h2>
        {memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma memória ainda.</p>
        ) : (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id}>
                <Card className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{m.title}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {m.scope}
                        </Badge>
                        {m.case ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {m.case.title}
                          </Badge>
                        ) : null}
                        {m.private ? (
                          <Badge variant="outline" className="text-[10px]">
                            privada
                          </Badge>
                        ) : null}
                        {m.useAsModel ? (
                          <Badge className="text-[10px]">modelo</Badge>
                        ) : null}
                        {m.useAsStyle ? (
                          <Badge className="text-[10px]">estilo</Badge>
                        ) : null}
                        {m.optInRag ? (
                          <Badge variant="secondary" className="text-[10px]">
                            RAG
                          </Badge>
                        ) : null}
                        {m.archivedAt ? (
                          <Badge variant="outline" className="text-[10px]">
                            arquivada
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Atualizado {new Date(m.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy === m.id}
                        onClick={() => patch(m.id, { optInRag: !m.optInRag })}
                      >
                        RAG: {m.optInRag ? "off" : "on"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy === m.id}
                        onClick={() => patch(m.id, { archived: !m.archivedAt })}
                      >
                        {m.archivedAt ? "Desarquivar" : "Arquivar"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={busy === m.id} onClick={() => remove(m.id)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
