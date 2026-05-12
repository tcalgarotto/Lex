"use client";

import { useMemo, useState, useTransition } from "react";
import type { CaseParty } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import {
 CASE_PARTY_KIND_LABEL,
 CASE_PARTY_ROLE_LABEL,
} from "@/lib/cases/labels";
import { maybeMaskDocument, maybeMaskPhone } from "@/lib/format/pii";
import { cn } from "@/lib/utils";

function readPhone(p: CaseParty): string | null {
 const m = p.metadataJson as { phone?: unknown } | null | undefined;
 if (m && typeof m === "object" && typeof m.phone === "string") return m.phone;
 return null;
}

function readAddress(p: CaseParty): string | null {
 const m = p.metadataJson as { address?: unknown } | null | undefined;
 if (m && typeof m === "object" && typeof m.address === "string") return m.address;
 return null;
}

type PartyMeta = {
 source?: string;
 status?: string;
 confidence?: number;
 phone?: string;
 address?: string;
 notes?: string;
};

function readMeta(p: CaseParty): PartyMeta {
 const m = p.metadataJson as PartyMeta | null | undefined;
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
 className={cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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

export function CasePartiesTab({ parties }: { parties: CaseParty[] }) {
 const caseId = parties[0]?.caseId ?? null;
 const [items, setItems] = useState<CaseParty[]>(parties);
 const [showFull, setShowFull] = useState(false);
 const [isPending, startTransition] = useTransition();
 const [editingId, setEditingId] = useState<string | null>(null);
 const [creating, setCreating] = useState(false);
 const [draft, setDraft] = useState<{
 role: CaseParty["role"];
 kind: CaseParty["kind"];
 name: string;
 document: string;
 phone: string;
 address: string;
 source: string;
 status: string;
 confidence: string;
 }>({
 role: "AUTHOR",
 kind: "UNKNOWN",
 name: "",
 document: "",
 phone: "",
 address: "",
 source: "manual",
 status: "editado",
 confidence: "0.85",
 });

 const sorted = useMemo(() => [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), [items]);

 function readApiError(json: unknown): string | null {
 if (!json || typeof json !== "object") return null;
 if (!("error" in json)) return null;
 const err = (json as Record<string, unknown>)["error"];
 return typeof err === "string" && err.trim().length > 0 ? err : null;
 }

 async function callApi(method: "POST" | "PATCH" | "DELETE", body: unknown) {
 if (!caseId) throw new Error("caseId ausente");
 const res = await fetch(`/api/cases/${caseId}/parties`, {
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
 role: "AUTHOR",
 kind: "UNKNOWN",
 name: "",
 document: "",
 phone: "",
 address: "",
 source: "manual",
 status: "editado",
 confidence: "0.85",
 });
 }

 function beginEdit(p: CaseParty) {
 const m = readMeta(p);
 setEditingId(p.id);
 setCreating(false);
 setDraft({
 role: p.role,
 kind: p.kind,
 name: p.name,
 document: p.document ?? "",
 phone: m.phone ?? readPhone(p) ?? "",
 address: m.address ?? readAddress(p) ?? "",
 source: m.source ?? "intake",
 status: m.status ?? "inferido",
 confidence: String(m.confidence ?? 0.85),
 });
 }

 function saveCreate() {
 startTransition(() => {
 void callApi("POST", {
 role: draft.role,
 kind: draft.kind,
 name: draft.name,
 document: draft.document || undefined,
 phone: draft.phone || undefined,
 address: draft.address || undefined,
 source: draft.source || undefined,
 status: draft.status || undefined,
 confidence: draft.confidence ? Number(draft.confidence) : undefined,
 }).then((r) => {
 const created = r && typeof r === "object" && "party" in r ? (r as { party: CaseParty }).party : null;
 if (created) setItems((prev) => [...prev, created]);
 setCreating(false);
 });
 });
 }

 function saveEdit(id: string) {
 startTransition(() => {
 void callApi("PATCH", {
 id,
 role: draft.role,
 kind: draft.kind,
 name: draft.name,
 document: draft.document ? draft.document : null,
 phone: draft.phone ? draft.phone : null,
 address: draft.address ? draft.address : null,
 source: draft.source ? draft.source : null,
 status: draft.status ? draft.status : null,
 confidence: draft.confidence ? Number(draft.confidence) : undefined,
 }).then((r) => {
 const updated = r && typeof r === "object" && "party" in r ? (r as { party: CaseParty }).party : null;
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
 <span>Nenhuma parte cadastrada.</span>
 <Button type="button" size="sm" onClick={beginCreate}>
 Adicionar parte
 </Button>
 </div>
 </Card>
 );
 }

 return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Button type="button" size="sm" variant="secondary" onClick={beginCreate} disabled={isPending || !caseId}>
 Adicionar parte
 </Button>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => setShowFull((v) => !v)}
 className="text-[11px] text-muted-foreground"
 aria-pressed={showFull}
 >
 {showFull ? (
 <>
 <EyeOff className="mr-1 size-3" /> Ocultar dados sensíveis
 </>
 ) : (
 <>
 <Eye className="mr-1 size-3" /> Mostrar dados completos
 </>
 )}
 </Button>
 </div>

 {creating ? (
 <Card className="p-3">
 <div className="space-y-3">
 <div className="grid gap-2 md:grid-cols-2">
 <Select
 value={draft.role}
 onChange={(v) => setDraft((d) => ({ ...d, role: v as CaseParty["role"] }))}
 options={[
 { value: "AUTHOR", label: "Autora" },
 { value: "DEFENDANT", label: "Ré" },
 { value: "INTERVENING", label: "Terceira/Interessada" },
 { value: "OTHER", label: "Outra" },
 ]}
 />
 <Select
 value={draft.kind}
 onChange={(v) => setDraft((d) => ({ ...d, kind: v as CaseParty["kind"] }))}
 options={[
 { value: "PERSON", label: "Pessoa física" },
 { value: "COMPANY", label: "Pessoa jurídica" },
 { value: "PUBLIC_ENTITY", label: "Ente público" },
 { value: "UNKNOWN", label: "Não definido" },
 ]}
 />
 </div>
 <div className="grid gap-2 md:grid-cols-2">
 <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nome" />
 <Input value={draft.document} onChange={(e) => setDraft((d) => ({ ...d, document: e.target.value }))} placeholder="CPF/CNPJ (opcional)" />
 </div>
 <div className="grid gap-2 md:grid-cols-2">
 <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="Telefone (opcional)" />
 <Input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="Endereço (opcional)" />
 </div>
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
 <Button type="button" onClick={saveCreate} disabled={isPending || draft.name.trim().length < 2}>
 Salvar
 </Button>
 </div>
 </div>
 </Card>
 ) : null}

 <div className="grid gap-2 md:grid-cols-2">
 {sorted.map((p) => {
 const phone = readPhone(p);
 const address = readAddress(p);
 const meta = readMeta(p);
 const displaySource = meta.source ?? "intake";
 const displayStatus = meta.status ?? "inferido";
 const displayConfidence = meta.confidence ?? 0.85;
 const isEditing = editingId === p.id;
 return (
 <Card key={p.id} className="p-3">
 {isEditing ? (
 <div className="space-y-3">
 <div className="grid gap-2 md:grid-cols-2">
 <Select
 value={draft.role}
 onChange={(v) => setDraft((d) => ({ ...d, role: v as CaseParty["role"] }))}
 options={[
 { value: "AUTHOR", label: "Autora" },
 { value: "DEFENDANT", label: "Ré" },
 { value: "INTERVENING", label: "Terceira/Interessada" },
 { value: "OTHER", label: "Outra" },
 ]}
 />
 <Select
 value={draft.kind}
 onChange={(v) => setDraft((d) => ({ ...d, kind: v as CaseParty["kind"] }))}
 options={[
 { value: "PERSON", label: "Pessoa física" },
 { value: "COMPANY", label: "Pessoa jurídica" },
 { value: "PUBLIC_ENTITY", label: "Ente público" },
 { value: "UNKNOWN", label: "Não definido" },
 ]}
 />
 </div>
 <div className="grid gap-2 md:grid-cols-2">
 <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nome" />
 <Input value={draft.document} onChange={(e) => setDraft((d) => ({ ...d, document: e.target.value }))} placeholder="CPF/CNPJ (opcional)" />
 </div>
 <div className="grid gap-2 md:grid-cols-2">
 <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="Telefone (opcional)" />
 <Input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="Endereço (opcional)" />
 </div>
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
 <Button type="button" size="sm" onClick={() => saveEdit(p.id)} disabled={isPending || draft.name.trim().length < 2}>
 Salvar
 </Button>
 </div>
 </div>
 ) : (
 <>
 <div className="flex items-center justify-between">
 <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
 {CASE_PARTY_ROLE_LABEL[p.role] ?? p.role}
 </Badge>
 <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
 {CASE_PARTY_KIND_LABEL[p.kind] ?? p.kind}
 </Badge>
 </div>
 <h3 className="mt-2 text-sm font-medium">{p.name}</h3>
 {p.document ? (
 <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" data-testid="party-document">
 {maybeMaskDocument(p.document, showFull)}
 </p>
 ) : null}
 {phone ? (
 <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
 {maybeMaskPhone(phone, showFull)}
 </p>
 ) : null}
 {address ? (
 <p className="mt-1 text-[11px] text-muted-foreground">
 {showFull ? address : address.replace(/\d/g, "•")}
 </p>
 ) : null}
 <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
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
 <div className="mt-2 flex items-center justify-end gap-2">
 <Button type="button" size="sm" variant="ghost" onClick={() => beginEdit(p)} disabled={isPending}>
 Editar
 </Button>
 <Button type="button" size="sm" variant="ghost" onClick={() => remove(p.id)} disabled={isPending}>
 Excluir
 </Button>
 </div>
 </>
 )}
 </Card>
 );
 })}
 </div>
 </div>
 );
}
