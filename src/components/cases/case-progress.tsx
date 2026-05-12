/**
 * <CaseProgressBar /> — versão compacta e por fases.
 * Agrupa as 10 etapas em 4 fases visuais:
 * Início · Processamento · Inteligência · Produção
 * Clique em qualquer bolinha para ver o nome + status da etapa.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type CaseProgressInput = {
 documents: { status: string }[];
 facts: { id: string }[];
 parties: { id: string }[];
 requests: { id: string }[];
 legalSources: { id: string }[];
 drafts: { id: string }[];
 reviews: { id: string }[];
 metadataJson: unknown;
};

type StepStatus = "done" | "pending" | "blocked";

type Step = {
 label: string;
 status: StepStatus;
};

type Phase = {
 name: string;
 steps: Step[];
};

/* ─── helpers ─── */
function hasBrain(m: unknown): boolean {
 if (!m || typeof m !== "object") return false;
 return !!(m as { brain?: unknown }).brain;
}
function hasStrategy(m: unknown): boolean {
 if (!m || typeof m !== "object") return false;
 return !!(m as { strategy?: unknown }).strategy;
}

function buildPhases(c: CaseProgressInput): Phase[] {
 const docsCount = c.documents.length;
 const docsIndexed = c.documents.filter((d) => d.status === "INDEXED").length;
 const docsFailed = c.documents.filter((d) => d.status === "FAILED").length;

 const st = (ok: boolean, blocked?: boolean): StepStatus =>
 ok ? "done" : blocked ? "blocked" : "pending";

 return [
 {
 name: "Início",
 steps: [
 { label: "Caso criado", status: "done" },
 { label: "Documento enviado", status: st(docsCount > 0) },
 ],
 },
 {
 name: "Processamento",
 steps: [
 {
 label: "Documento processado",
 status: st(
 docsIndexed > 0,
 docsFailed > 0 && docsCount === docsFailed,
 ),
 },
 { label: "Fatos extraídos", status: st(c.facts.length > 0) },
 { label: "Partes identificadas", status: st(c.parties.length > 0) },
 { label: "Pedidos identificados", status: st(c.requests.length > 0) },
 ],
 },
 {
 name: "Inteligência",
 steps: [
 {
 label: "Inteligência do caso",
 status: st(hasBrain(c.metadataJson)),
 },
 {
 label: "Fundamentos pinados",
 status: st(c.legalSources.length > 0),
 },
 ],
 },
 {
 name: "Produção",
 steps: [
 { label: "Estratégia gerada", status: st(hasStrategy(c.metadataJson)) },
 {
 label: c.reviews.length > 0 ? "Peça revisada" : "Peça gerada",
 status: st(c.reviews.length > 0 || c.drafts.length > 0),
 },
 ],
 },
 ];
}

/* ─── sub-components ─── */
const ICON: Record<StepStatus, string> = { done: "✓", pending: "·", blocked: "!" };

function StatusDot({
 step,
 selected,
 onClick,
}: {
 step: Step;
 selected: boolean;
 onClick: () => void;
}) {
 return (
 <button
 type="button"
 onClick={onClick}
 aria-label={step.label}
 className={cn("flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-[0.5px] text-[8px] lex-transition hover:scale-110",
 step.status === "done" &&
 "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]",
 step.status === "pending" &&
 "border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-disabled)]",
 step.status === "blocked" &&
 "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]",
 selected && "ring-2 ring-[color:var(--brand-border)]",
 )}
 >
 {ICON[step.status]}
 </button>
 );
}

function PhaseCard({
 phase,
 selectedStep,
 onSelect,
}: {
 phase: Phase;
 selectedStep: Step | null;
 onSelect: (s: Step | null) => void;
}) {
 const done = phase.steps.filter((s) => s.status === "done").length;
 const pct = Math.round((done / phase.steps.length) * 100);
 const allDone = done === phase.steps.length;

 return (
 <div
 className={cn("flex flex-1 flex-col gap-2 rounded-[10px] border-[0.5px] p-[10px_12px] lex-transition",
 allDone
 ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"
 : "border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]",
 )}
 >
 <div className="flex items-center justify-between">
 <span className="text-[9.5px] font-medium uppercase tracking-widest text-[color:var(--text-muted)]">
 {phase.name}
 </span>
 <span
 className={cn("text-[9px]",
 done > 0 ? "text-[color:var(--success-text)]" : "text-[color:var(--text-disabled)]",
 )}
 >
 {done}/{phase.steps.length}
 </span>
 </div>

 <div className="flex flex-wrap gap-[5px]">
 {phase.steps.map((step) => (
 <StatusDot
 key={step.label}
 step={step}
 selected={selectedStep?.label === step.label}
 onClick={() =>
 onSelect(selectedStep?.label === step.label ? null : step)
 }
 />
 ))}
 </div>

 <div className="h-[2px] w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)]">
 <div
 className="h-full rounded-full bg-[color:var(--progress-high)] lex-transition"
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
}

/* ─── main component ─── */
export function CaseProgressBar({ caseData }: { caseData: CaseProgressInput }) {
 const [selectedStep, setSelectedStep] = useState<Step | null>(null);

 const phases = buildPhases(caseData);
 const allSteps = phases.flatMap((p) => p.steps);
 const doneCount = allSteps.filter((s) => s.status === "done").length;
 const total = allSteps.length;
 const pct = Math.round((doneCount / total) * 100);
 const nextStep = allSteps.find((s) => s.status !== "done");

 const handleSelect = (step: Step | null) => setSelectedStep(step);

 const STATUS_LABEL: Record<StepStatus, string> = {
 done: "Concluído",
 pending: "Pendente",
 blocked: "Bloqueado",
 };

 const barColor =
 pct >= 70 ? "var(--progress-high)" : pct >= 40 ? "var(--progress-mid)" : "var(--progress-low)";

 return (
 <div className="lex-glass lex-transition rounded-[14px] p-4 md:p-5">
 <div className="mb-2.5 flex items-center justify-between">
 <span className="text-[10px] font-medium uppercase tracking-widest text-[color:var(--text-muted)]">
 Progresso do caso
 </span>
 <div className="flex items-center gap-1.5">
 <span
 className="rounded-full border-[0.5px] border-[color:var(--border-default)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--text-secondary)]"
 style={{ background: "var(--surface-elevated)" }}
 >
 {doneCount} / {total}
 </span>
 <span className="font-mono text-[11px] text-[color:var(--text-muted)]">{pct}%</span>
 </div>
 </div>

 <div
 className="mb-3.5 h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
 role="progressbar"
 aria-valuenow={pct}
 aria-valuemin={0}
 aria-valuemax={100}
 >
 <div
 className="h-full rounded-full lex-transition"
 style={{
 width: `${pct}%`,
 background: barColor,
 }}
 />
 </div>

 <div className="flex flex-col gap-2 sm:flex-row">
 {phases.map((phase) => (
 <PhaseCard
 key={phase.name}
 phase={phase}
 selectedStep={selectedStep}
 onSelect={handleSelect}
 />
 ))}
 </div>

 {selectedStep && (
 <div className="mt-2.5 flex items-center gap-2 rounded-lg border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-card)] px-3 py-1.5">
 <span
 className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-[0.5px] text-[8px]",
 selectedStep.status === "done" &&
 "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]",
 selectedStep.status === "pending" &&
 "border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]",
 selectedStep.status === "blocked" &&
 "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]",
 )}
 >
 {ICON[selectedStep.status]}
 </span>
 <span className="text-[11.5px] text-[color:var(--text-secondary)]">{selectedStep.label}</span>
 <span
 className={cn("ml-auto rounded-full border-[0.5px] px-2 py-0.5 text-[10px]",
 selectedStep.status === "done" &&
 "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]",
 selectedStep.status === "pending" &&
 "border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]",
 selectedStep.status === "blocked" &&
 "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]",
 )}
 >
 {STATUS_LABEL[selectedStep.status]}
 </span>
 </div>
 )}

 <div className="mt-2 flex flex-wrap items-center gap-1">
 <span className="text-[10px] text-[color:var(--text-disabled)]">Próximo passo:</span>
 <span className="text-[10px] text-[color:var(--text-secondary)]">
 {nextStep?.label ?? "Todas as etapas concluídas ✓"}
 </span>
 </div>
 </div>
 );
}
