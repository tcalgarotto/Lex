"use client";

import { useMemo, useState, useTransition } from "react";
import type { CaseFact } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CaseDataOriginButton } from "@/components/cases/case-data-origin";
import { parseMetadataJson } from "@/lib/cases/data-origin-meta";

const CATEGORY_TONE: Record<string, string> = {
 data: "border-blue-500/30 text-blue-200 bg-blue-500/5",
 dano: "border-rose-500/30 text-rose-200 bg-rose-500/5",
 conduta: "border-amber-500/30 text-amber-200 bg-amber-500/5",
 vinculo: "border-emerald-500/30 text-emerald-200 bg-emerald-500/5",
 valor: "border-purple-500/30 text-purple-200 bg-purple-500/5",
 mora: "border-orange-500/30 text-orange-200 bg-orange-500/5",
 tutela: "border-indigo-500/30 text-indigo-200 bg-indigo-500/5",
};

type FactMeta = { source?: string; status?: string; confidence?: number };

function readMeta(f: CaseFact): FactMeta {
 const m = parseMetadataJson(f.metadataJson);
 return {
 source: m.source,
 status: m.status,
 confidence: m.confidence,
 };
}

export function CaseFactsTab({ facts }: { facts: CaseFact[] }) {
 const caseId = facts[0]?.caseId ?? null;
 const [items, setItems] = useState<CaseFact[]>(facts);
 const [isPending, startTransition] = useTransition();
 const [editingId, setEditingId] = useState<string | null>(null);
 const [creating, setCreating] = useState(false);
 const [draft, setDraft] = useState<{
 text: string;
 category: string;
 dates: string;
 confidence: string;
 source: string;
 status: string;
 }>({
 text: "",
 category: "",
 dates: "",
 confidence: "0.85",
 source: "manual",
 status: "editado",
 });

 const sorted = useMemo(
 () => [...items].sort((a, b) => a.ordinal - b.ordinal),
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
 const res = await fetch(`/api/cases/${caseId}/facts`, {
 method,
 headers: { "content-type": "application/json" },
 body: JSON.stringify(body),
 });
 const json = (await res.json().catch(() => null)) as unknown;
 if (!res.ok) {
 throw new Error(readApiError(json) ?? "Erro");
 }
 return json;
 }

 function beginCreate() {
 setCreating(true);
 setEditingId(null);
 setDraft({
 text: "",
 category: "",
 dates: "",
 confidence: "0.85",
 source: "manual",
 status: "editado",
 });
 }

 function beginEdit(f: CaseFact) {
 const m = readMeta(f);
 setEditingId(f.id);
 setCreating(false);
 setDraft({
 text: f.text,
 category: f.category ?? "",
 dates: f.dates.join(", "),
 confidence: String(m.confidence ?? f.confidence ?? 0.6),
 source: m.source ?? "intake",
 status: m.status ?? "inferido",
 });
 }

 function parseDates(input: string) {
 const items = input
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean);
 return items.length ? items : [];
 }

 function saveCreate() {
 const dates = parseDates(draft.dates);
 startTransition(() => {
 void callApi("POST", {
 text: draft.text,
 category: draft.category || undefined,
 dates: dates.length ? dates : undefined,
 confidence: draft.confidence ? Number(draft.confidence) : undefined,
 }).then((r) => {
 const created = r && typeof r === "object" && "fact" in r ? (r as { fact: CaseFact }).fact : null;
 if (created) setItems((prev) => [...prev, created]);
 setCreating(false);
 });
 });
 }

 function saveEdit(id: string) {
 const dates = parseDates(draft.dates);
 startTransition(() => {
 void callApi("PATCH", {
 id,
 text: draft.text,
 category: draft.category || null,
 dates,
 confidence: draft.confidence ? Number(draft.confidence) : undefined,
 }).then((r) => {
 const updated = r && typeof r === "object" && "fact" in r ? (r as { fact: CaseFact }).fact : null;
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
 <span>Nenhum fato cadastrado ainda.</span>
 <Button type="button" size="sm" onClick={beginCreate}>
 Adicionar fato
 </Button>
 </div>
 </Card>
 );
 }

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-end">
 <Button type="button" size="sm" variant="secondary" onClick={beginCreate} disabled={isPending || !caseId}>
 Adicionar fato
 </Button>
 </div>

 {creating ? (
 <Card className="p-3">
 <div className="space-y-3">
 <Textarea
 value={draft.text}
 onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
 placeholder="Descreva o fato (o que aconteceu, quando, quem fez o quê)."
 />
 <div className="grid gap-2 md:grid-cols-3">
 <Input
 value={draft.category}
 onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
 placeholder="Categoria (opcional)"
 />
 <Input
 value={draft.dates}
 onChange={(e) => setDraft((d) => ({ ...d, dates: e.target.value }))}
 placeholder="Datas (ISO, separadas por vírgula)"
 />
 <Input
 value={draft.confidence}
 onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))}
 placeholder="Confiança (0..1)"
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

 {sorted.map((f) => {
 const meta = readMeta(f);
 const displayConfidence = meta.confidence ?? f.confidence ?? 0.6;
 const isEditing = editingId === f.id;

 return (
 <Card key={f.id} className="p-3">
 <div className="flex items-start gap-3">
 <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px]">
 {String(f.ordinal).padStart(2, "0")}
 </span>
 <div className="flex-1 space-y-2">
 {isEditing ? (
 <div className="space-y-3">
 <Textarea
 value={draft.text}
 onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
 />
 <div className="grid gap-2 md:grid-cols-3">
 <Input
 value={draft.category}
 onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
 placeholder="Categoria (opcional)"
 />
 <Input
 value={draft.dates}
 onChange={(e) => setDraft((d) => ({ ...d, dates: e.target.value }))}
 placeholder="Datas (ISO, separadas por vírgula)"
 />
 <Input
 value={draft.confidence}
 onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))}
 placeholder="Confiança (0..1)"
 />
 </div>
 <div className="flex items-center justify-end gap-2">
 <Button type="button" variant="ghost" onClick={() => setEditingId(null)} disabled={isPending}>
 Cancelar
 </Button>
 <Button
 type="button"
 onClick={() => saveEdit(f.id)}
 disabled={isPending || draft.text.trim().length < 2}
 >
 Salvar
 </Button>
 </div>
 </div>
 ) : (
 <>
 <p className="text-sm leading-relaxed">{f.text}</p>
 <div className="flex flex-wrap gap-1.5 text-[10px]">
 {f.category ? (
 <Badge variant="outline" className={CATEGORY_TONE[f.category] ?? ""}>
 {f.category}
 </Badge>
 ) : null}
 {f.dates.map((d) => (
 <Badge key={d} variant="outline" className="font-mono text-[10px]">
 {d}
 </Badge>
 ))}
 <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
 conf {Number(displayConfidence).toFixed(2)}
 </Badge>
 </div>
 <div className="flex flex-wrap items-center justify-end gap-2">
 <CaseDataOriginButton
 kind="fact"
 metadataJson={f.metadataJson}
 confidence={f.confidence}
 createdAt={f.createdAt}
 />
 <Button type="button" size="sm" variant="ghost" onClick={() => beginEdit(f)} disabled={isPending}>
 Editar
 </Button>
 <Button type="button" size="sm" variant="ghost" onClick={() => remove(f.id)} disabled={isPending}>
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
