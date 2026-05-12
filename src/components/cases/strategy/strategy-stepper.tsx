/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import { Check, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEPS = [
 "Dados do caso",
 "Fatos e provas",
 "Fundamentos",
 "Pedidos",
 "Revisão",
 "Exportação",
] as const;

type Props = {
 /** 0 = primeiro passo */
 activeIndex: number;
 readinessPercent: number;
};

export function StrategyStepper({ activeIndex, readinessPercent }: Props) {
 const pct = Math.max(0, Math.min(100, Math.round(readinessPercent)));
 return (
 <div className="space-y-4">
 <div>
 <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
 Etapas sugeridas
 </p>
 <ol className="mt-2 space-y-2 border-l border-border pl-3">
 {STEPS.map((label, i) => {
 const done = i < activeIndex;
 const current = i === activeIndex;
 return (
 <li key={label} className="relative pl-4">
 <span
 className={cn("absolute -left-[17px] top-0.5 flex size-5 items-center justify-center rounded-full border text-[10px]",
 done && "border-emerald-500/60 bg-emerald-500/20 text-emerald-200",
 current && !done && "border-primary bg-primary/15 text-primary",
 !done && !current && "border-border bg-background text-muted-foreground",
 )}
 >
 {done ? <Check className="size-3" /> : <Circle className="size-3" />}
 </span>
 <span
 className={cn("text-sm",
 current ? "font-medium text-foreground" : "text-muted-foreground",
 )}
 >
 {label}
 </span>
 </li>
 );
 })}
 </ol>
 </div>

 <div className="rounded-md border border-border bg-muted/20 p-3">
 <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
 Prontidão do caso
 </p>
 <div className="mt-2 flex items-center gap-3">
 <span className="text-xl font-semibold tabular-nums text-foreground">{pct}%</span>
 <Progress value={pct} className="h-2 flex-1" />
 </div>
 <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
 Percentual calculado a partir da prontidão processual consolidada no caso.
 </p>
 </div>
 </div>
 );
}
