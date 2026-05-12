"use client";

/**
 * F2.1 — UI da entrevista guiada.
 *
 * Um acordeão por seção. Cada campo aparece com indicador visual:
 * - vermelho: pendente (required + sem resposta)
 * - amarelo: parcial (preenchido mas com baixa confiança / preencheu rapidamente)
 * - verde: confirmado pela cliente
 *
 * O botão "Salvar respostas" envia para `POST /api/cases/[id]/checklist`,
 * que persiste e dispara `lex/case.brain` (sem espera bloqueante na UI).
 *
 * A lista "Próximas perguntas para a cliente" é gerada do backend via
 * `missingFields` e tem botão "Copiar roteiro" para WhatsApp/telefone.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, ChevronDown, Check, AlertCircle, Copy, ListChecks } from "lucide-react";
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
import type {
 ChecklistField,
 ChecklistSection,
 ChecklistTemplate,
} from "@/lib/cases/checklists/registry";
import { listChecklistTemplates } from "@/lib/cases/checklists/registry";

type InterviewTemplateListItem = {
 id: string;
 scope: "USER" | "WORKSPACE";
 title: string;
 description: string | null;
 domain: string | null;
 updatedAt: string;
};

type ChecklistApiResponse = {
 template: ChecklistTemplate | null;
 suggestedTemplate: boolean;
 answers: Record<string, unknown>;
 missingFields: ChecklistField[];
 answeredAt: string | null;
};

type SubmitResponse = {
 savedFields: string[];
 missingFields: { id: string; label: string }[];
 nextBestAction: string;
};

interface Props {
 caseId: string;
 /** Pré-carrega via SSR se passado; senão buscamos no GET. */
 initial?: ChecklistApiResponse | null;
}

export function CaseChecklistTab({ caseId, initial }: Props) {
 const [data, setData] = useState<ChecklistApiResponse | null>(initial ?? null);
 const [loading, setLoading] = useState(!initial);
 const [err, setErr] = useState<string | null>(null);
 const [answers, setAnswers] = useState<Record<string, unknown>>(initial?.answers ?? {});
 const [openSections, setOpenSections] = useState<Set<string>>(
 new Set(initial?.template?.sections.map((s) => s.id) ?? []),
 );
 const [saving, startSaving] = useTransition();
 const [savedAt, setSavedAt] = useState<string | null>(initial?.answeredAt ?? null);
 const [nextAction, setNextAction] = useState<string | null>(null);
 const templates = useMemo(() => listChecklistTemplates(), []);
 const [savedTemplates, setSavedTemplates] = useState<InterviewTemplateListItem[] | null>(null);

 useEffect(() => {
 if (initial) return;
 setLoading(true);
 fetch(`/api/cases/${caseId}/checklist`)
 .then((r) => r.json())
 .then((j: ChecklistApiResponse) => {
 setData(j);
 setAnswers(j.answers ?? {});
 setOpenSections(new Set(j.template?.sections.map((s) => s.id) ?? []));
 setSavedAt(j.answeredAt);
 })
 .catch((e) => setErr((e as Error).message))
 .finally(() => setLoading(false));
 }, [caseId, initial]);

 useEffect(() => {
 // best-effort: carrega modelos salvos (F6). Não quebra se falhar.
 fetch("/api/interview-templates")
 .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`))))
 .then((j: { templates: InterviewTemplateListItem[] }) => setSavedTemplates(j.templates ?? []))
 .catch(() => setSavedTemplates([]));
 }, []);

 const template = data?.template ?? null;
 const missingFields = useMemo(() => {
 if (!template) return [];
 const out: ChecklistField[] = [];
 for (const section of template.sections) {
 for (const f of section.fields) {
 if (!f.required) continue;
 if (!isAnswered(f, answers[f.id])) out.push(f);
 }
 }
 return out;
 }, [template, answers]);

 function setAnswer(fieldId: string, value: unknown) {
 setAnswers((prev) => ({ ...prev, [fieldId]: value }));
 }

 function toggleSection(id: string) {
 setOpenSections((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }

 function copyScript() {
 if (missingFields.length === 0) return;
 const lines = missingFields.map((f, i) => `${i + 1}. ${f.label}${f.helpText ? ` (${f.helpText})` : ""}`);
 const head = `Roteiro de perguntas para a cliente — ${template?.label ?? ""}\n\n`;
 void navigator.clipboard.writeText(head + lines.join("\n"));
 }

 async function save() {
 if (!template) return;
 startSaving(async () => {
 try {
 const res = await fetch(`/api/cases/${caseId}/checklist`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ templateId: template.id, answers }),
 });
 if (!res.ok) {
 const body = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(body.error ?? `falha ${res.status}`);
 }
 const json = (await res.json()) as SubmitResponse;
 setSavedAt(new Date().toISOString());
 setNextAction(json.nextBestAction);
 } catch (e) {
 setErr((e as Error).message);
 }
 });
 }

 async function changeTemplate(templateId: string) {
 try {
 const staticTpl = templates.find((t) => t.id === templateId) ?? null;
 let resolved: ChecklistTemplate | null = staticTpl;
 if (!resolved) {
 const j = (await fetch(
 `/api/cases/${caseId}/checklist?templateId=${encodeURIComponent(templateId)}`,
 ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`falha ${r.status}`))))) as ChecklistApiResponse;
 resolved = j.template ?? null;
 }

 setData((prev) => {
 if (!prev) return prev;
 return { ...prev, template: resolved ?? prev.template, suggestedTemplate: false };
 });
 setAnswers({});
 setOpenSections(new Set(resolved?.sections.map((s) => s.id) ?? []));
 setSavedAt(null);
 setNextAction(null);
 } catch (e) {
 setErr((e as Error).message);
 }
 }

 if (loading) {
 return (
 <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
 <Loader2 className="size-4 animate-spin" /> Carregando entrevista guiada…
 </div>
 );
 }

 if (err) {
 return (
 <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-100">
 <p className="font-medium">Falha ao carregar checklist</p>
 <p className="text-xs">{err}</p>
 </Card>
 );
 }

 if (!template) {
 return (
 <Card className="p-4 text-sm text-muted-foreground">
 <p>
 Nenhum checklist sugerido automaticamente para este caso ainda. Quando a inteligência do
 caso identificar a área (ex.: Educação + Infância), oferecemos o checklist correspondente.
 </p>
 </Card>
 );
 }

 return (
 <div className="space-y-4">
 <Card className="p-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
 Entrevista guiada
 </p>
 <h3 className="mt-1 text-base font-semibold">{template.label}</h3>
 <p className="mt-1 text-xs text-muted-foreground">
 {data?.suggestedTemplate
 ? "Sugerido automaticamente a partir do relato/área do caso."
 : "Selecionado manualmente."}{" "}
 v{template.version}
 </p>
 </div>
 <div className="flex flex-col items-end gap-1 text-xs">
 <span className="text-muted-foreground">
 {missingFields.length === 0
 ? "Todos os campos obrigatórios respondidos"
 : `${missingFields.length} campo(s) obrigatório(s) pendente(s)`}
 </span>
 {savedAt ? (
 <span className="text-muted-foreground">
 Última atualização: {new Date(savedAt).toLocaleString("pt-BR")}
 </span>
 ) : null}
 <div className="mt-1">
 <Dialog>
 <DialogTrigger asChild>
 <Button type="button" size="sm" variant="outline">
 Trocar roteiro
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-xl">
 <DialogHeader>
 <DialogTitle>Escolher roteiro de entrevista</DialogTitle>
 </DialogHeader>
 <div className="grid gap-2">
 {savedTemplates && savedTemplates.length > 0 ? (
 <>
 <p className="text-xs font-medium text-muted-foreground">Modelos salvos</p>
 {savedTemplates.slice(0, 10).map((t) => (
 <button
 key={t.id}
 type="button"
 onClick={() => void changeTemplate(t.id)}
 className="rounded-md border p-3 text-left hover:bg-[color:var(--surface-overlay)]"
 >
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="text-sm font-medium">{t.title}</p>
 <p className="mt-0.5 text-xs text-muted-foreground">
 {t.scope === "WORKSPACE" ? "Workspace" : "Meu"}{" "}
 {t.domain ? `· ${t.domain}` : ""} · atualizado{" "}
 {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
 </p>
 </div>
 <Badge variant={t.id === template.id ? "default" : "outline"} className="text-[10px]">
 {t.id === template.id ? "Atual" : "Selecionar"}
 </Badge>
 </div>
 </button>
 ))}
 <div className="h-px bg-white/10" />
 </>
 ) : null}

 <p className="text-xs font-medium text-muted-foreground">Modelos padrão</p>
 {templates.map((t) => (
 <button
 key={t.id}
 type="button"
 onClick={() => void changeTemplate(t.id)}
 className="rounded-md border p-3 text-left hover:bg-[color:var(--surface-overlay)]"
 >
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="text-sm font-medium">{t.label}</p>
 <p className="mt-0.5 text-xs text-muted-foreground">
 {t.area.join(" · ")} · v{t.version}
 </p>
 </div>
 <Badge variant={t.id === template.id ? "default" : "outline"} className="text-[10px]">
 {t.id === template.id ? "Atual" : "Selecionar"}
 </Badge>
 </div>
 </button>
 ))}
 </div>
 <p className="text-xs text-muted-foreground">
 Trocar o roteiro não apaga o caso, mas as respostas desta aba serão reiniciadas para o roteiro selecionado.
 </p>
 </DialogContent>
 </Dialog>
 </div>
 </div>
 </div>
 </Card>

 {missingFields.length > 0 ? (
 <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-100">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <p className="mb-1 inline-flex items-center gap-1 font-medium">
 <ListChecks className="size-3" /> Próximas perguntas para a cliente
 </p>
 <ol className="list-decimal pl-5">
 {missingFields.slice(0, 8).map((f) => (
 <li key={f.id}>{f.label}</li>
 ))}
 {missingFields.length > 8 ? (
 <li className="opacity-70">+ {missingFields.length - 8} pendente(s)…</li>
 ) : null}
 </ol>
 </div>
 <Button type="button" variant="ghost" size="sm" onClick={copyScript}>
 <Copy className="mr-1 size-3" /> Copiar roteiro
 </Button>
 </div>
 </Card>
 ) : null}

 <div className="space-y-2">
 {template.sections.map((section) => (
 <SectionBlock
 key={section.id}
 section={section}
 answers={answers}
 isOpen={openSections.has(section.id)}
 onToggle={() => toggleSection(section.id)}
 onChange={setAnswer}
 />
 ))}
 </div>

 <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] backdrop-blur-xl p-3 backdrop-blur">
 <div className="text-xs text-muted-foreground">
 {nextAction ?? "Salvar dispara reconsolidação da inteligência do caso."}
 </div>
 <Button onClick={save} disabled={saving}>
 {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Check className="mr-1 size-3" />}
 Salvar respostas
 </Button>
 </div>
 </div>
 );
}

/* ---------------------- internal components --------------------------- */

function SectionBlock({
 section,
 answers,
 isOpen,
 onToggle,
 onChange,
}: {
 section: ChecklistSection;
 answers: Record<string, unknown>;
 isOpen: boolean;
 onToggle: () => void;
 onChange: (id: string, value: unknown) => void;
}) {
 const filled = section.fields.filter((f) => isAnswered(f, answers[f.id])).length;
 const total = section.fields.length;
 const requiredMissing = section.fields.some(
 (f) => f.required && !isAnswered(f, answers[f.id]),
 );

 return (
 <Card className="overflow-hidden">
 <button
 type="button"
 onClick={onToggle}
 className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/[0.02]"
 >
 <div>
 <p className="text-sm font-medium">{section.title}</p>
 {section.description ? (
 <p className="mt-0.5 text-[11px] text-muted-foreground">{section.description}</p>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 <Badge
 variant={requiredMissing ? "outline" : "default"}
 className={
 requiredMissing
 ? "border-amber-500/40 text-amber-200"
 : filled === total
 ? "bg-emerald-500/15 text-emerald-200"
 : ""
 }
 >
 {filled}/{total}
 </Badge>
 <ChevronDown
 className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
 />
 </div>
 </button>

 {isOpen ? (
 <div className="space-y-3 border-t border-[color:var(--border-default)] px-4 py-4">
 {section.fields.map((field) => (
 <FieldBlock
 key={field.id}
 field={field}
 value={answers[field.id]}
 onChange={(v) => onChange(field.id, v)}
 />
 ))}
 </div>
 ) : null}
 </Card>
 );
}

function FieldBlock({
 field,
 value,
 onChange,
}: {
 field: ChecklistField;
 value: unknown;
 onChange: (v: unknown) => void;
}) {
 const answered = isAnswered(field, value);
 const tone = field.required && !answered ? "warn" : answered ? "ok" : "muted";

 return (
 <div className="space-y-1">
 <label className="flex items-center gap-2 text-xs font-medium">
 {tone === "warn" ? (
 <AlertCircle className="size-3 text-amber-400" />
 ) : tone === "ok" ? (
 <Check className="size-3 text-emerald-400" />
 ) : null}
 <span>{field.label}</span>
 {field.required ? <span className="text-rose-300">*</span> : null}
 {field.blocker ? (
 <Badge variant="outline" className="ml-1 border-rose-500/30 text-[10px] text-rose-200">
 crítico
 </Badge>
 ) : null}
 </label>
 {field.helpText ? (
 <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
 ) : null}
 <FieldInput field={field} value={value} onChange={onChange} />
 </div>
 );
}

function FieldInput({
 field,
 value,
 onChange,
}: {
 field: ChecklistField;
 value: unknown;
 onChange: (v: unknown) => void;
}) {
 const v = value;
 switch (field.kind) {
 case "long_text":
 return (
 <Textarea
 value={typeof v === "string" ? v : ""}
 onChange={(e) => onChange(e.target.value)}
 rows={3}
 />
 );
 case "boolean":
 return (
 <div className="flex gap-2">
 <Button
 type="button"
 size="sm"
 variant={v === true ? "default" : "outline"}
 onClick={() => onChange(true)}
 >
 Sim
 </Button>
 <Button
 type="button"
 size="sm"
 variant={v === false ? "default" : "outline"}
 onClick={() => onChange(false)}
 >
 Não
 </Button>
 </div>
 );
 case "single_choice":
 return (
 <div className="flex flex-wrap gap-2">
 {(field.options ?? []).map((opt) => (
 <Button
 key={opt.id}
 type="button"
 size="sm"
 variant={v === opt.id ? "default" : "outline"}
 onClick={() => onChange(opt.id)}
 >
 {opt.label}
 </Button>
 ))}
 </div>
 );
 case "multi_choice": {
 const arr = Array.isArray(v) ? (v as string[]) : [];
 return (
 <div className="flex flex-wrap gap-2">
 {(field.options ?? []).map((opt) => {
 const sel = arr.includes(opt.id);
 return (
 <Button
 key={opt.id}
 type="button"
 size="sm"
 variant={sel ? "default" : "outline"}
 onClick={() => {
 if (sel) onChange(arr.filter((x) => x !== opt.id));
 else onChange([...arr, opt.id]);
 }}
 >
 {opt.label}
 </Button>
 );
 })}
 </div>
 );
 }
 case "date":
 return (
 <Input
 type="date"
 value={typeof v === "string" ? v : ""}
 onChange={(e) => onChange(e.target.value)}
 />
 );
 case "number":
 return (
 <Input
 type="number"
 value={typeof v === "number" ? v : typeof v === "string" ? v : ""}
 onChange={(e) => {
 const n = Number(e.target.value);
 onChange(Number.isFinite(n) ? n : e.target.value);
 }}
 />
 );
 default:
 return (
 <Input
 type="text"
 value={typeof v === "string" ? v : ""}
 onChange={(e) => onChange(e.target.value)}
 />
 );
 }
}

function isAnswered(field: ChecklistField, value: unknown): boolean {
 if (value === undefined || value === null) return false;
 if (typeof value === "string") return value.trim().length > 0;
 if (typeof value === "number") return Number.isFinite(value);
 if (typeof value === "boolean") return true;
 if (Array.isArray(value)) return value.length > 0;
 if (typeof value === "object") return Object.keys(value).length > 0;
 return false;
}
