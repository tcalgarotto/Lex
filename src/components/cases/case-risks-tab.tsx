"use client";

import { useMemo, useState, useTransition } from "react";
import type { CaseRisk } from "@prisma/client";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<string, { tone: string; icon: typeof ShieldAlert }> = {
  CRITICAL: { tone: "border-rose-500/40 text-rose-300 bg-rose-500/10", icon: ShieldAlert },
  HIGH: { tone: "border-rose-500/30 text-rose-200 bg-rose-500/5", icon: ShieldAlert },
  MEDIUM: { tone: "border-amber-500/30 text-amber-200 bg-amber-500/5", icon: AlertTriangle },
  LOW: { tone: "border-blue-500/30 text-blue-200 bg-blue-500/5", icon: Info },
};

const KIND_LABEL: Record<string, string> = {
  REVOKED_NORM: "Norma revogada",
  PRECEDENT_DIVERGENCE: "Divergência jurisprudencial",
  HISTORIC_VERSION: "Versão histórica",
  MISSING_GROUNDING: "Lacuna de fundamentação",
  WEAK_ARGUMENT: "Argumento frágil",
  PROCEDURAL_GAP: "Lacuna processual",
  OTHER: "Outro risco",
};

type RiskMeta = { source?: string; status?: string; confidence?: number };
function readMeta(r: CaseRisk): RiskMeta {
  const m = r.metadataJson as RiskMeta | null | undefined;
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

export function CaseRisksTab({ risks }: { risks: CaseRisk[] }) {
  const caseId = risks[0]?.caseId ?? null;
  const [items, setItems] = useState<CaseRisk[]>(risks);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    severity: CaseRisk["severity"];
    kind: string;
    title: string;
    detail: string;
    evidenceNormUrns: string;
    source: string;
    status: string;
    confidence: string;
  }>({
    severity: "MEDIUM",
    kind: "OTHER",
    title: "",
    detail: "",
    evidenceNormUrns: "",
    source: "manual",
    status: "editado",
    confidence: "0.75",
  });

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [items],
  );

  function readApiError(json: unknown): string | null {
    if (!json || typeof json !== "object") return null;
    if (!("error" in json)) return null;
    const err = (json as Record<string, unknown>)["error"];
    return typeof err === "string" && err.trim().length > 0 ? err : null;
  }

  async function callApi(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    if (!caseId) throw new Error("caseId ausente");
    const res = await fetch(`/api/cases/${caseId}/risks`, {
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
      severity: "MEDIUM",
      kind: "OTHER",
      title: "",
      detail: "",
      evidenceNormUrns: "",
      source: "manual",
      status: "editado",
      confidence: "0.75",
    });
  }

  function beginEdit(r: CaseRisk) {
    const m = readMeta(r);
    setEditingId(r.id);
    setCreating(false);
    setDraft({
      severity: r.severity,
      kind: r.kind,
      title: r.title,
      detail: r.detail,
      evidenceNormUrns: r.evidenceNormUrns.join(", "),
      source: m.source ?? "intake",
      status: m.status ?? "inferido",
      confidence: String(m.confidence ?? 0.75),
    });
  }

  function parseUrns(input: string) {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function saveCreate() {
    const evidenceNormUrns = parseUrns(draft.evidenceNormUrns);
    startTransition(() => {
      void callApi("POST", {
        severity: draft.severity,
        kind: draft.kind,
        title: draft.title,
        detail: draft.detail,
        evidenceNormUrns: evidenceNormUrns.length ? evidenceNormUrns : undefined,
        source: draft.source || undefined,
        status: draft.status || undefined,
        confidence: draft.confidence ? Number(draft.confidence) : undefined,
      }).then((r) => {
        const created = r && typeof r === "object" && "risk" in r ? (r as { risk: CaseRisk }).risk : null;
        if (created) setItems((prev) => [created, ...prev]);
        setCreating(false);
      });
    });
  }

  function saveEdit(id: string) {
    const evidenceNormUrns = parseUrns(draft.evidenceNormUrns);
    startTransition(() => {
      void callApi("PATCH", {
        id,
        severity: draft.severity,
        kind: draft.kind,
        title: draft.title,
        detail: draft.detail,
        evidenceNormUrns,
        source: draft.source || null,
        status: draft.status || null,
        confidence: draft.confidence ? Number(draft.confidence) : undefined,
      }).then((r) => {
        const updated = r && typeof r === "object" && "risk" in r ? (r as { risk: CaseRisk }).risk : null;
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

  const intro = (
    <Card className="p-4 text-sm text-muted-foreground">
      Risco é uma fragilidade do caso que pode prejudicar a medida judicial, como falta de prova,
      autoridade errada, pedido mal definido ou fundamento jurídico fraco.
    </Card>
  );

  if (!sorted.length && !creating) {
    return (
      <div className="space-y-2">
        {intro}
        <Card className="p-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Sem riscos identificados.</span>
            <Button type="button" size="sm" onClick={beginCreate}>
              Adicionar risco
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {intro}
      <div className="flex items-center justify-end">
        <Button type="button" size="sm" variant="secondary" onClick={beginCreate} disabled={isPending || !caseId}>
          Adicionar risco
        </Button>
      </div>

      {creating ? (
        <Card className="p-3">
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Select
                value={draft.severity}
                onChange={(v) => setDraft((d) => ({ ...d, severity: v as CaseRisk["severity"] }))}
                options={[
                  { value: "LOW", label: "Baixa" },
                  { value: "MEDIUM", label: "Média" },
                  { value: "HIGH", label: "Alta" },
                  { value: "CRITICAL", label: "Crítica" },
                ]}
              />
              <Input value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))} placeholder="Tipo (ex.: OTHER, PROCEDURAL_GAP)" />
            </div>
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Título" />
            <Textarea value={draft.detail} onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))} placeholder="Descrição do risco e por que importa." />
            <Input value={draft.evidenceNormUrns} onChange={(e) => setDraft((d) => ({ ...d, evidenceNormUrns: e.target.value }))} placeholder="URNs de evidência (opcional; separadas por vírgula)" />
            <div className="grid gap-2 md:grid-cols-3">
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
              <Input value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))} placeholder="Confiança (0..1)" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={saveCreate}
                disabled={isPending || draft.title.trim().length < 2 || draft.detail.trim().length < 2}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {sorted.map((r) => {
        const meta = SEVERITY_TONE[r.severity] ?? SEVERITY_TONE["LOW"]!;
        const Icon = meta.icon;
        const m = readMeta(r);
        const displaySource = m.source ?? "intake";
        const displayStatus = m.status ?? "inferido";
        const displayConfidence = m.confidence ?? 0.75;
        const isEditing = editingId === r.id;
        return (
          <Card key={r.id} className={`p-3 ${meta.tone}`}>
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select
                        value={draft.severity}
                        onChange={(v) => setDraft((d) => ({ ...d, severity: v as CaseRisk["severity"] }))}
                        options={[
                          { value: "LOW", label: "Baixa" },
                          { value: "MEDIUM", label: "Média" },
                          { value: "HIGH", label: "Alta" },
                          { value: "CRITICAL", label: "Crítica" },
                        ]}
                      />
                      <Input value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))} placeholder="Tipo" />
                    </div>
                    <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Título" />
                    <Textarea value={draft.detail} onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))} />
                    <Input value={draft.evidenceNormUrns} onChange={(e) => setDraft((d) => ({ ...d, evidenceNormUrns: e.target.value }))} placeholder="URNs de evidência (vírgula)" />
                    <div className="grid gap-2 md:grid-cols-3">
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
                      <Input value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))} placeholder="Confiança (0..1)" />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={isPending}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveEdit(r.id)}
                        disabled={isPending || draft.title.trim().length < 2 || draft.detail.trim().length < 2}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {r.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium">{r.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                    {r.evidenceNormUrns.length ? (
                      <p className="break-all font-mono text-[10px] text-muted-foreground">
                        {r.evidenceNormUrns.join(" · ")}
                      </p>
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
