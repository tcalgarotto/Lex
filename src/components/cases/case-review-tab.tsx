"use client";

import type { CaseReview } from "@prisma/client";
import { CheckCircle2, AlertCircle, XCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from "@/components/ui/tooltip";

type ChecklistItem = {
 id: string;
 title: string;
 status: "pass" | "warning" | "fail";
 detail: string;
 weight: number;
 /** F6 — explicação detalhada para o tooltip. */
 rationale?: string;
};

const STATUS_ICON = {
 pass: { icon: CheckCircle2, tone: "text-emerald-300" },
 warning: { icon: AlertCircle, tone: "text-amber-300" },
 fail: { icon: XCircle, tone: "text-rose-300" },
} as const;

export function CaseReviewTab({ reviews }: { reviews: CaseReview[] }) {
 if (!reviews.length) {
 return <Card className="p-4 text-sm text-muted-foreground">Nenhuma review executada.</Card>;
 }
 const last = reviews[0]!;
 const items = (last.checklistJson as unknown as ChecklistItem[]) ?? [];
 const verdictTone = verdictToTone(last.verdict);
 return (
 <TooltipProvider delayDuration={120}>
 <div className="space-y-3">
 <Card className={`p-4 ${verdictTone.border}`}>
 <div className="flex items-baseline justify-between">
 <h3 className={`text-sm font-semibold ${verdictTone.text}`}>{last.verdict}</h3>
 <span className="font-mono text-sm text-muted-foreground">
 {last.score.toFixed(2)}
 </span>
 </div>
 <Progress value={Math.round(last.score * 100)} className="mt-2 h-2" />
 <p className="mt-1 text-[11px] text-muted-foreground">
 {new Date(last.createdAt).toLocaleString("pt-BR")}
 {verdictTone.tip ? <span className="ml-2 italic">{verdictTone.tip}</span> : null}
 </p>
 </Card>
 <div className="space-y-2">
 {items.map((item) => {
 const { icon: Icon, tone } = STATUS_ICON[item.status] ?? STATUS_ICON.pass;
 return (
 <Card key={item.id} className="p-3">
 <div className="flex items-start gap-3">
 <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <h4 className="text-sm font-medium">{item.title}</h4>
 <Badge variant="outline" className="text-[10px] uppercase">
 {item.status}
 </Badge>
 {item.rationale ? (
 <Tooltip>
 <TooltipTrigger asChild>
 <button
 type="button"
 className="text-muted-foreground hover:text-foreground"
 aria-label="Explicação detalhada"
 >
 <Info className="size-3" />
 </button>
 </TooltipTrigger>
 <TooltipContent side="top" className="max-w-xs">
 {item.rationale}
 </TooltipContent>
 </Tooltip>
 ) : null}
 </div>
 <p className="text-xs text-muted-foreground">{item.detail}</p>
 </div>
 </div>
 </Card>
 );
 })}
 </div>
 </div>
 </TooltipProvider>
 );
}

function verdictToTone(verdict: string): { border: string; text: string; tip?: string } {
 if (/Pronta para protocolo/i.test(verdict)) {
 return {
 border: "border-emerald-500/30",
 text: "text-emerald-200",
 tip: "Score >= 0.9, sem warnings, sem bloqueantes — segura para protocolar.",
 };
 }
 if (/N[ãa]o-protocol[áa]vel/i.test(verdict)) {
 return {
 border: "border-rose-500/40",
 text: "text-rose-200",
 tip: "Existe pelo menos 1 critério bloqueante (placeholders, partes, fundamentos, inconsistências).",
 };
 }
 if (/Pend[êe]ncias cr[íi]ticas/i.test(verdict)) {
 return {
 border: "border-amber-500/40",
 text: "text-amber-200",
 tip: "Há fails que precisam ser resolvidos antes de protocolar.",
 };
 }
 if (/Quase pronta/i.test(verdict)) {
 return {
 border: "border-amber-500/20",
 text: "text-amber-100",
 tip: "Score alto, mas com warnings — revise os itens antes do protocolo.",
 };
 }
 return {
 border: "border-violet-500/20",
 text: "text-violet-200",
 tip: "Em construção — gere a peça novamente após resolver pendências.",
 };
}
