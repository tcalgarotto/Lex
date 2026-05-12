"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from "@/components/ui/dialog";
import { listChecklistTemplates } from "@/lib/cases/checklists/registry";

type InterviewTemplateListItem = {
 id: string;
 scope: "USER" | "WORKSPACE";
 ownerUserId: string | null;
 title: string;
 description: string | null;
 domain: string | null;
 updatedAt: string;
 createdAt: string;
};

type InterviewTemplate = InterviewTemplateListItem & {
 schemaJson: unknown;
};

export default function RoteirosSettingsClientPage() {
 const [items, setItems] = useState<InterviewTemplateListItem[] | null>(null);
 const [err, setErr] = useState<string | null>(null);
 const [busy, startBusy] = useTransition();

 const baseTemplates = useMemo(() => listChecklistTemplates(), []);

 async function reload() {
 setErr(null);
 const j = (await fetch("/api/interview-templates").then((r) =>
 r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`)),
 )) as { templates: InterviewTemplateListItem[] };
 setItems(j.templates ?? []);
 }

 useEffect(() => {
 void reload().catch((e) => setErr((e as Error).message));
 }, []);

 async function createFromBase(args: { scope: "USER" | "WORKSPACE"; title: string; baseId: string }) {
 const base = baseTemplates.find((t) => t.id === args.baseId);
 if (!base) throw new Error("Modelo base não encontrado");

 const schemaJson = { ...base, id: undefined, label: args.title };
 await fetch("/api/interview-templates", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ scope: args.scope, title: args.title, schemaJson }),
 }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`))));

 await reload();
 }

 async function remove(id: string) {
 await fetch(`/api/interview-templates/${id}`, { method: "DELETE" }).then((r) =>
 r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`)),
 );
 await reload();
 }

 async function loadFull(id: string) {
 const j = (await fetch(`/api/interview-templates/${id}`).then((r) =>
 r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`)),
 )) as { template: InterviewTemplate };
 return j.template;
 }

 async function update(id: string, patch: { title?: string; description?: string | null; domain?: string | null; schemaJson?: unknown }) {
 await fetch(`/api/interview-templates/${id}`, {
 method: "PATCH",
 headers: { "content-type": "application/json" },
 body: JSON.stringify(patch),
 }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`))));
 await reload();
 }

 return (
 <div className="space-y-4">
 <Card className="p-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="space-y-1">
 <p className="text-sm font-medium">Modelos do workspace e pessoais</p>
 <p className="text-xs text-muted-foreground">
 Use para padronizar a entrevista guiada e reduzir perguntas repetidas.
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => void reload().catch((e) => setErr((e as Error).message))}
 >
 <RefreshCcw className="mr-2 size-4" />
 Atualizar
 </Button>
 <CreateFromBaseDialog
 disabled={busy}
 baseTemplates={baseTemplates.map((t) => ({
 id: t.id,
 label: t.label,
 meta: `${t.area.join(" · ")} · v${t.version}`,
 }))}
 onCreate={(args) =>
 startBusy(async () => {
 try {
 await createFromBase(args);
 } catch (e) {
 setErr((e as Error).message);
 }
 })
 }
 />
 </div>
 </div>
 </Card>

 {err ? (
 <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-100">
 <p className="font-medium">Falha</p>
 <p className="text-xs">{err}</p>
 </Card>
 ) : null}

 {items === null ? (
 <Card className="p-4 text-sm text-muted-foreground">Carregando roteiros…</Card>
 ) : items.length === 0 ? (
 <Card className="p-4 text-sm text-muted-foreground">
 Nenhum modelo salvo ainda. Crie um a partir de um modelo padrão.
 </Card>
 ) : (
 <div className="grid gap-2">
 {items.map((t) => (
 <Card key={t.id} className="p-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate text-sm font-medium">{t.title}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 {t.scope === "WORKSPACE" ? "Workspace" : "Meu"}{" "}
 {t.domain ? `· ${t.domain}` : ""} · atualizado{" "}
 {new Date(t.updatedAt).toLocaleString("pt-BR")}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="text-[10px]">
 {t.scope === "WORKSPACE" ? "WORKSPACE" : "USER"}
 </Badge>
 <EditTemplateDialog
 templateId={t.id}
 disabled={busy}
 loadFull={loadFull}
 onSave={(patch) =>
 startBusy(async () => {
 try {
 await update(t.id, patch);
 } catch (e) {
 setErr((e as Error).message);
 }
 })
 }
 />
 <Button
 type="button"
 size="icon"
 variant="outline"
 disabled={busy}
 onClick={() =>
 startBusy(async () => {
 try {
 await remove(t.id);
 } catch (e) {
 setErr((e as Error).message);
 }
 })
 }
 aria-label="Excluir roteiro"
 >
 <Trash2 className="size-4" />
 </Button>
 </div>
 </div>
 </Card>
 ))}
 </div>
 )}
 </div>
 );
}

function CreateFromBaseDialog({
 disabled,
 baseTemplates,
 onCreate,
}: {
 disabled: boolean;
 baseTemplates: { id: string; label: string; meta: string }[];
 onCreate: (args: { scope: "USER" | "WORKSPACE"; title: string; baseId: string }) => void;
}) {
 const [open, setOpen] = useState(false);
 const [scope, setScope] = useState<"USER" | "WORKSPACE">("WORKSPACE");
 const [title, setTitle] = useState("");
 const [baseId, setBaseId] = useState(baseTemplates[0]?.id ?? "");

 return (
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger asChild>
 <Button type="button" size="sm" disabled={disabled}>
 <Plus className="mr-2 size-4" />
 Novo roteiro
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-xl">
 <DialogHeader>
 <DialogTitle>Criar roteiro a partir de um modelo padrão</DialogTitle>
 </DialogHeader>
 <div className="grid gap-3">
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Título</p>
 <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Cobrança indevida — cartão" />
 </div>
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Escopo</p>
 <div className="flex gap-2">
 <Button type="button" variant={scope === "WORKSPACE" ? "secondary" : "outline"} size="sm" onClick={() => setScope("WORKSPACE")}>
 Workspace
 </Button>
 <Button type="button" variant={scope === "USER" ? "secondary" : "outline"} size="sm" onClick={() => setScope("USER")}>
 Meu
 </Button>
 </div>
 </div>
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Base</p>
 <div className="grid gap-2">
 {baseTemplates.slice(0, 8).map((t) => (
 <button
 key={t.id}
 type="button"
 className="rounded-md border p-3 text-left hover:bg-[color:var(--surface-overlay)]"
 onClick={() => setBaseId(t.id)}
 >
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="text-sm font-medium">{t.label}</p>
 <p className="mt-0.5 text-xs text-muted-foreground">{t.meta}</p>
 </div>
 <Badge variant={baseId === t.id ? "default" : "outline"} className="text-[10px]">
 {baseId === t.id ? "Selecionado" : "Usar"}
 </Badge>
 </div>
 </button>
 ))}
 </div>
 <p className="text-[11px] text-muted-foreground">
 Depois você pode editar o JSON do roteiro (perguntas, seções, etc.).
 </p>
 </div>
 <div className="flex justify-end gap-2">
 <Button type="button" variant="outline" onClick={() => setOpen(false)}>
 Cancelar
 </Button>
 <Button
 type="button"
 disabled={!title.trim() || !baseId}
 onClick={() => {
 onCreate({ scope, title: title.trim(), baseId });
 setOpen(false);
 }}
 >
 Criar
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}

function EditTemplateDialog({
 templateId,
 disabled,
 loadFull,
 onSave,
}: {
 templateId: string;
 disabled: boolean;
 loadFull: (id: string) => Promise<InterviewTemplate>;
 onSave: (patch: { title?: string; description?: string | null; domain?: string | null; schemaJson?: unknown }) => void;
}) {
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [title, setTitle] = useState("");
 const [domain, setDomain] = useState("");
 const [description, setDescription] = useState("");
 const [schemaText, setSchemaText] = useState("");
 const [err, setErr] = useState<string | null>(null);

 useEffect(() => {
 if (!open) return;
 setErr(null);
 setLoading(true);
 loadFull(templateId)
 .then((tpl) => {
 setTitle(tpl.title ?? "");
 setDomain(tpl.domain ?? "");
 setDescription(tpl.description ?? "");
 setSchemaText(JSON.stringify(tpl.schemaJson ?? {}, null, 2));
 })
 .catch((e) => setErr((e as Error).message))
 .finally(() => setLoading(false));
 }, [open, templateId, loadFull]);

 return (
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger asChild>
 <Button type="button" size="icon" variant="outline" disabled={disabled} aria-label="Editar roteiro">
 <Pencil className="size-4" />
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Editar roteiro</DialogTitle>
 </DialogHeader>
 {loading ? (
 <Card className="p-4 text-sm text-muted-foreground">Carregando…</Card>
 ) : err ? (
 <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-100">{err}</Card>
 ) : (
 <div className="grid gap-3">
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Título</p>
 <Input value={title} onChange={(e) => setTitle(e.target.value)} />
 </div>
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Domínio (opcional)</p>
 <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Ex.: consumidor, família, trabalhista" />
 </div>
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Descrição (opcional)</p>
 <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
 </div>
 <div className="grid gap-1">
 <p className="text-xs text-muted-foreground">Schema (JSON)</p>
 <Textarea value={schemaText} onChange={(e) => setSchemaText(e.target.value)} rows={12} className="font-mono text-xs" />
 {err ? <p className="text-xs text-rose-100">{err}</p> : null}
 </div>
 <div className="flex justify-end gap-2">
 <Button type="button" variant="outline" onClick={() => setOpen(false)}>
 Cancelar
 </Button>
 <Button
 type="button"
 onClick={() => {
 setErr(null);
 try {
 const parsed = JSON.parse(schemaText);
 onSave({
 title: title.trim() || undefined,
 description: description.trim() ? description.trim() : null,
 domain: domain.trim() ? domain.trim() : null,
 schemaJson: parsed,
 });
 setOpen(false);
 } catch (e) {
 setErr((e as Error).message);
 }
 }}
 >
 Salvar
 </Button>
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 );
}

