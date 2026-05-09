"use client";

import { useMemo, useState, useTransition } from "react";
import type { CaseRequest } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  MAIN: { label: "Principal", tone: "border-indigo-500/30 text-indigo-200 bg-indigo-500/5" },
  SUBSIDIARY: { label: "Subsidiário", tone: "border-purple-500/30 text-purple-200 bg-purple-500/5" },
  URGENCY: { label: "Tutela de Urgência", tone: "border-rose-500/30 text-rose-200 bg-rose-500/5" },
  PROVISIONAL: { label: "Provisório", tone: "border-orange-500/30 text-orange-200 bg-orange-500/5" },
  EVIDENCE: { label: "Provas", tone: "border-blue-500/30 text-blue-200 bg-blue-500/5" },
  PROCEDURAL: { label: "Processual", tone: "border-emerald-500/30 text-emerald-200 bg-emerald-500/5" },
  OTHER: { label: "Outro", tone: "" },
};

type RequestMeta = { source?: string; status?: string; confidence?: number };
function readMeta(r: CaseRequest): RequestMeta {
  const m = r.metadataJson as RequestMeta | null | undefined;
  if (!m || typeof m !== "object") return {};
  return m;
}

function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CaseRequestsTab({ requests }: { requests: CaseRequest[] }) {
  const caseId = requests[0]?.caseId ?? null;
  const [items, setItems] = useState<CaseRequest[]>(requests);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    kind: CaseRequest["kind"];
    text: string;
    legalBasisUrn: string;
    source: string;
    status: string;
    confidence: string;
  }>({
    kind: "MAIN",
    text: "",
    legalBasisUrn: "",
    source: "manual",
    status: "editado",
    confidence: "0.80",
  });

  const sorted = useMemo(() => [...items].sort((a, b) => a.ordinal - b.ordinal), [items]);

  function readApiError(json: unknown): string | null {
    if (!json || typeof json !== "object") return null;
    if (!("error" in json)) return null;
    const err = (json as Record<string, unknown>)["error"];
    return typeof err === "string" && err.trim().length > 0 ? err : null;
  }

  async function callApi(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    if (!caseId) throw new Error("caseId ausente");
    const res = await fetch(`/api/cases/${caseId}/requests`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw new Error(readApiError(json) ?? "Erro");
    return json;
  }

  function beginCreate() {
    setCreating(true);
    setEditingId(null);
    setDraft({
      kind: "MAIN",
      text: "",
      legalBasisUrn: "",
      source: "manual",
      status: "editado",
      confidence: "0.80",
    });
  }

  function beginEdit(r: CaseRequest) {
    const m = readMeta(r);
    setEditingId(r.id);
    setCreating(false);
    setDraft({
      kind: r.kind,
      text: r.text,
      legalBasisUrn: r.legalBasisUrn ?? "",
      source: m.source ?? "intake",
      status: m.status ?? "inferido",
      confidence: String(m.confidence ?? 0.8),
    });
  }

  function saveCreate() {
    startTransition(() => {
      void callApi("POST", {
        kind: draft.kind,
        text: draft.text,
        legalBasisUrn: draft.legalBasisUrn || undefined,
        source: draft.source || undefined,
        status: draft.status || undefined,
        confidence: draft.confidence ? Number(draft.confidence) : undefined,
      }).then((r) => {
        const created = r && typeof r === "object" && "request" in r ? (r as { request: CaseRequest }).request : null;
        if (created) setItems((prev) => [...prev, created]);
        setCreating(false);
      });
    });
  }

  function saveEdit(id: string) {
    startTransition(() => {
      void callApi("PATCH", {
        id,
        kind: draft.kind,
        text: draft.text,
        legalBasisUrn: draft.legalBasisUrn ? draft.legalBasisUrn : null,
        source: draft.source ? draft.source : null,
        status: draft.status ? draft.status : null,
        confidence: draft.confidence ? Number(draft.confidence) : undefined,
      }).then((r) => {
        const updated = r && typeof r === "object" && "request" in r ? (r as { request: CaseRequest }).request : null;
        if (updated) setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
        setEditingId(null);
      });
    });
  }

  function remove(id: string) {
    startTransition(() => {
      void callApi("DELETE", { id }).then(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
        if (editingId === id) setEditingId(null);
      });
    });
  }

  if (!sorted.length && !creating) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span>Nenhum pedido cadastrado.</span>
          <Button type="button" size="sm" onClick={beginCreate}>
            Adicionar pedido
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button type="button" size="sm" variant="secondary" onClick={beginCreate} disabled={isPending || !caseId}>
          Adicionar pedido
        </Button>
      </div>

      {creating ? (
        <Card className="p-3">
          <div className="space-y-3">
            <Select
              value={draft.kind}
              onChange={(v) => setDraft((d) => ({ ...d, kind: v as CaseRequest["kind"] }))}
              options={[
                { value: "MAIN", label: "Principal" },
                { value: "SUBSIDIARY", label: "Subsidiário" },
                { value: "URGENCY", label: "Tutela de Urgência" },
                { value: "PROVISIONAL", label: "Provisório" },
                { value: "EVIDENCE", label: "Provas" },
                { value: "PROCEDURAL", label: "Processual" },
                { value: "OTHER", label: "Outro" },
              ]}
            />
            <Textarea value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} placeholder="Descreva o pedido (o que se pretende obter)." />
            <div className="grid gap-2 md:grid-cols-2">
              <Input value={draft.legalBasisUrn} onChange={(e) => setDraft((d) => ({ ...d, legalBasisUrn: e.target.value }))} placeholder="Base legal (URN, opcional)" />
              <Input value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))} placeholder="Confiança (0..1)" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Origem" />
              <Select
                value={draft.status}
                onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                options={[
                  { value: "inferido", label: "Inferido" },
                  { value: "confirmado", label: "Confirmado" },
                  { value: "editado", label: "Editado" },
                ]}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={saveCreate} disabled={isPending || draft.text.trim().length < 2}>
                Salvar
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {sorted.map((r) => {
        const meta = KIND_LABEL[r.kind] ?? { label: r.kind, tone: "" };
        const m = readMeta(r);
        const displaySource = m.source ?? "intake";
        const displayStatus = m.status ?? "inferido";
        const displayConfidence = m.confidence ?? 0.8;
        const isEditing = editingId === r.id;
        return (
          <Card key={r.id} className="p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px]">
                {String(r.ordinal).padStart(2, "0")}
              </span>
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <div className="space-y-3">
                    <Select
                      value={draft.kind}
                      onChange={(v) => setDraft((d) => ({ ...d, kind: v as CaseRequest["kind"] }))}
                      options={[
                        { value: "MAIN", label: "Principal" },
                        { value: "SUBSIDIARY", label: "Subsidiário" },
                        { value: "URGENCY", label: "Tutela de Urgência" },
                        { value: "PROVISIONAL", label: "Provisório" },
                        { value: "EVIDENCE", label: "Provas" },
                        { value: "PROCEDURAL", label: "Processual" },
                        { value: "OTHER", label: "Outro" },
                      ]}
                    />
                    <Textarea value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} />
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={draft.legalBasisUrn} onChange={(e) => setDraft((d) => ({ ...d, legalBasisUrn: e.target.value }))} placeholder="Base legal (URN, opcional)" />
                      <Input value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))} placeholder="Confiança (0..1)" />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Origem" />
                      <Select
                        value={draft.status}
                        onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                        options={[
                          { value: "inferido", label: "Inferido" },
                          { value: "confirmado", label: "Confirmado" },
                          { value: "editado", label: "Editado" },
                        ]}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={isPending}>
                        Cancelar
                      </Button>
                      <Button type="button" size="sm" onClick={() => saveEdit(r.id)} disabled={isPending || draft.text.trim().length < 2}>
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
                      {meta.label}
                    </Badge>
                    <p className="text-sm leading-relaxed">{r.text}</p>
                    {r.legalBasisUrn ? (
                      <p className="font-mono text-[10px] text-muted-foreground">{r.legalBasisUrn}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        origem {displaySource}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        status {displayStatus}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                        conf {Number(displayConfidence).toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => beginEdit(r)} disabled={isPending}>
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => remove(r.id)} disabled={isPending}>
                        Excluir
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
