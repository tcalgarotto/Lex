"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
 ClipboardList,
 Files,
 Hash,
 Loader2,
 PenLine,
 Sparkles,
 Wand2,
 FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCnj } from "@/lib/cnj";

type Mode = "raw" | "interview" | "document" | "existing_process" | "empty";

const MODE_META: Record<
 Mode,
 { label: string; description: string; icon: typeof PenLine }
> = {
 raw: {
 label: "Relato livre",
 description:
 "Cole o relato bruto do cliente — partes, fatos e pedidos serão extraídos automaticamente.",
 icon: PenLine,
 },
 interview: {
 label: "Entrevista guiada",
 description:
 "Use um checklist jurídico estruturado para casos onde o cliente não chega com o relato pronto.",
 icon: ClipboardList,
 },
 document: {
 label: "Enviar documento",
 description:
 "Comece o caso a partir de uma petição, contrato ou prova — o caso aparece após o processamento do arquivo.",
 icon: Files,
 },
 existing_process: {
 label: "Processo existente",
 description:
 "Vincule o caso a um processo judicial já cadastrado (CNJ + tribunal/vara).",
 icon: Hash,
 },
 empty: {
 label: "Caso vazio",
 description: "Cria a pasta do caso minimalista, para preencher os detalhes depois.",
 icon: FileQuestion,
 },
};

const SAMPLE = `Autora: Maria Souza 111.222.333-44
Réu: Empresa ABC Ltda

A autora celebrou contrato de prestação de serviços com a ré em 12/03/2022. Em 05/05/2023 a ré deixou de prestar o serviço contratado, causando prejuízo material e abalo emocional.

Requer a rescisão contratual e a condenação ao ressarcimento de R$ 12.500,00 a título de danos materiais. Pleiteia tutela de urgência para imediata suspensão da cobrança.`;

export default function NewCasePage() {
 const router = useRouter();
 const [mode, setMode] = useState<Mode>("raw");
 const [text, setText] = useState("");
 const [title, setTitle] = useState("");
 const [processNumber, setProcessNumber] = useState("");
 const [tribunalCode, setTribunalCode] = useState("");
 const [uf, setUf] = useState("");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 async function submit() {
 setError(null);

 if (mode === "raw" && text.trim().length < 20) {
 setError("Descreva o caso com pelo menos 20 caracteres.");
 return;
 }
 if (mode === "interview" && title.trim().length === 0) {
 // título é opcional no backend, vira "Novo caso (entrevista guiada)" — ok seguir
 }
 if (mode === "existing_process") {
 if (title.trim().length < 2) {
 setError("Informe um título descritivo para o caso.");
 return;
 }
 if (processNumber.replace(/\D/g, "").length !== 20) {
 setError("Informe um número CNJ válido (20 dígitos).");
 return;
 }
 }
 if (mode === "empty" && title.trim().length < 2) {
 setError("Informe um título para o caso.");
 return;
 }

 setLoading(true);
 try {
 const payload: Record<string, unknown> = { mode };
 if (mode === "raw") payload["rawInput"] = text;
 if (mode === "interview" && title.trim().length > 0) payload["title"] = title;
 if (mode === "document" && title.trim().length > 0) payload["title"] = title;
 if (mode === "existing_process") {
 payload["title"] = title;
 payload["processNumber"] = processNumber;
 if (tribunalCode.trim()) payload["tribunalCode"] = tribunalCode.trim().toUpperCase();
 if (uf.trim()) payload["uf"] = uf.trim().toUpperCase();
 }
 if (mode === "empty") payload["title"] = title;

 const res = await fetch("/api/cases", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify(payload),
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
 <div className="w-full min-w-0 space-y-6">
 <header className="space-y-2">
 <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
 <Sparkles className="size-3.5" /> Como você quer começar?
 </div>
 <h1 className="text-2xl font-semibold">Novo caso</h1>
 <p className="text-sm text-muted-foreground">
 Caso é a pasta jurídica principal — pode ser pré-processual (sem CNJ ainda) ou já
 vinculado a um processo. Escolha o modo que melhor descreve o que você tem agora.
 </p>
 </header>

 <ModeTabs mode={mode} onChange={setMode} />

 <Card className="space-y-3 p-4" data-testid="case-mode-form">
 <p className="text-xs text-muted-foreground" data-testid="case-mode-description">
 {MODE_META[mode].description}
 </p>

 {mode === "raw" ? (
 <RawForm text={text} setText={setText} />
 ) : null}

 {mode === "interview" ? (
 <InterviewForm title={title} setTitle={setTitle} />
 ) : null}

 {mode === "document" ? (
 <DocumentForm title={title} setTitle={setTitle} />
 ) : null}

 {mode === "existing_process" ? (
 <ExistingProcessForm
 title={title}
 setTitle={setTitle}
 processNumber={processNumber}
 setProcessNumber={setProcessNumber}
 tribunalCode={tribunalCode}
 setTribunalCode={setTribunalCode}
 uf={uf}
 setUf={setUf}
 />
 ) : null}

 {mode === "empty" ? <EmptyForm title={title} setTitle={setTitle} /> : null}

 <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
 <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
 {MODE_META[mode].label}
 </Badge>
 <Button onClick={submit} disabled={loading} data-testid="case-submit">
 {loading ? (
 <Loader2 className="mr-1 size-4 animate-spin" />
 ) : (
 <Sparkles className="mr-1 size-4" />
 )}
 {mode === "interview"
 ? "Iniciar entrevista"
 : mode === "document"
 ? "Criar caso para o documento"
 : "Iniciar caso"}
 </Button>
 </div>
 {error && (
 <p className="text-xs text-rose-300" data-testid="case-error">
 {error}
 </p>
 )}
 </Card>

 <Card className="p-4 text-xs text-muted-foreground">
 <p>
 <strong className="text-foreground">Caso ≠ Processo judicial.</strong> O caso é a pasta
 principal. O processo judicial (CNJ + vara + tribunal) é opcional e só aparece quando você
 escolhe &quot;Processo existente&quot; ou marca o caso como protocolado depois.
 </p>
 </Card>
 </div>
 );
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
 const modes: Mode[] = ["raw", "interview", "document", "existing_process", "empty"];
 return (
 <div
 className="grid gap-2 sm:grid-cols-2 md:grid-cols-5"
 role="tablist"
 data-testid="case-mode-tabs"
 >
 {modes.map((m) => {
 const meta = MODE_META[m];
 const Icon = meta.icon;
 const active = m === mode;
 return (
 <button
 key={m}
 type="button"
 role="tab"
 aria-selected={active}
 data-testid={`case-mode-${m}`}
 onClick={() => onChange(m)}
 className={cn("flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
 active
 ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
 : "border-[color:var(--border-default)] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05]",
 )}
 >
 <div className="flex items-center gap-1.5">
 <Icon className="size-3.5" />
 <span className="text-[11px] font-semibold uppercase tracking-wide">
 {meta.label}
 </span>
 </div>
 <span className="line-clamp-2 text-[11px] leading-tight">{meta.description}</span>
 </button>
 );
 })}
 </div>
 );
}

function RawForm({ text, setText }: { text: string; setText: (s: string) => void }) {
 return (
 <>
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
 <span className="text-xs text-muted-foreground">{text.length} caracteres</span>
 </div>
 </>
 );
}

function InterviewForm({ title, setTitle }: { title: string; setTitle: (s: string) => void }) {
 return (
 <div className="space-y-3">
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Título sugerido (opcional)
 </label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Ex.: Vaga em creche — Lara (4 anos)"
 data-testid="case-interview-title"
 />
 </div>
 <p className="text-xs text-muted-foreground">
 Após criar o caso, abriremos um <strong>checklist jurídico estruturado</strong> para você
 coletar os dados com a cliente passo a passo. O checklist preencherá automaticamente fatos,
 partes, pedidos e identificará lacunas.
 </p>
 </div>
 );
}

function DocumentForm({ title, setTitle }: { title: string; setTitle: (s: string) => void }) {
 return (
 <div className="space-y-3">
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Título do caso (opcional)
 </label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Ex.: Análise de contrato — empresa XYZ"
 data-testid="case-document-title"
 />
 </div>
 <p className="text-xs text-muted-foreground">
 O caso será criado vazio. Após o redirecionamento, envie o documento (PDF/DOCX) na aba{" "}
 <strong>Documentos</strong> — o caso será populado automaticamente após o processamento.
 </p>
 </div>
 );
}

function ExistingProcessForm({
 title,
 setTitle,
 processNumber,
 setProcessNumber,
 tribunalCode,
 setTribunalCode,
 uf,
 setUf,
}: {
 title: string;
 setTitle: (s: string) => void;
 processNumber: string;
 setProcessNumber: (s: string) => void;
 tribunalCode: string;
 setTribunalCode: (s: string) => void;
 uf: string;
 setUf: (s: string) => void;
}) {
 return (
 <div className="space-y-3">
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Título do caso *
 </label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Ex.: Indenização contra Banco Y"
 data-testid="case-existing-title"
 />
 </div>
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Número CNJ *
 </label>
 <Input
 value={processNumber}
 onChange={(e) => setProcessNumber(e.target.value)}
 onBlur={() => setProcessNumber(formatCnj(processNumber))}
 placeholder="0000000-00.0000.0.00.0000"
 className="font-mono"
 inputMode="numeric"
 data-testid="case-existing-cnj"
 />
 </div>
 <div className="grid gap-2 sm:grid-cols-2">
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Tribunal (opcional)
 </label>
 <Input
 value={tribunalCode}
 onChange={(e) => setTribunalCode(e.target.value)}
 placeholder="Ex.: TJSP, TRF3, STJ"
 data-testid="case-existing-tribunal"
 />
 </div>
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 UF (opcional)
 </label>
 <Input
 value={uf}
 onChange={(e) => setUf(e.target.value.slice(0, 2).toUpperCase())}
 placeholder="SP"
 maxLength={2}
 data-testid="case-existing-uf"
 />
 </div>
 </div>
 </div>
 );
}

function EmptyForm({ title, setTitle }: { title: string; setTitle: (s: string) => void }) {
 return (
 <div className="space-y-3">
 <div>
 <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Título do caso *
 </label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Ex.: Caso sem detalhes ainda"
 data-testid="case-empty-title"
 />
 </div>
 <p className="text-xs text-muted-foreground">
 Caso vazio cria apenas a pasta — você adiciona partes, fatos, pedidos e fundamentos
 manualmente nas abas internas.
 </p>
 </div>
 );
}
