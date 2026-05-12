"use client";

import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type GroundingPanelProps = {
 score: number;
 label: "Alta" | "Média" | "Baixa";
 reason: string;
 candidates: {
 dense: number;
 bm25: number;
 afterFusion: number;
 afterGraph: number;
 afterRerank: number;
 final: number;
 };
};

const LABEL_TO_TONE = {
 Alta: { bg: "bg-emerald-500/10", text: "text-emerald-300", ring: "ring-emerald-500/30", icon: CheckCircle2 },
 Média: { bg: "bg-amber-500/10", text: "text-amber-300", ring: "ring-amber-500/30", icon: AlertTriangle },
 Baixa: { bg: "bg-rose-500/10", text: "text-rose-300", ring: "ring-rose-500/30", icon: ShieldAlert },
} as const;

export function GroundingPanel({ score, label, reason, candidates }: GroundingPanelProps) {
 const tone = LABEL_TO_TONE[label];
 const Icon = tone.icon;
 const pct = Math.round(score * 100);

 return (
 <div
 className={cn("rounded-xl border bg-card/40 p-5 ring-1 backdrop-blur-sm",
 tone.ring,
 )}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className={cn("rounded-lg p-2.5", tone.bg)}>
 <Icon className={cn("size-5", tone.text)} />
 </div>
 <div>
 <div className="flex items-baseline gap-2">
 <span className={cn("text-2xl font-semibold tabular-nums", tone.text)}>{pct}</span>
 <span className="text-xs text-muted-foreground">grounding</span>
 <span
 className={cn("ml-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
 tone.bg,
 tone.text,
 )}
 >
 {label}
 </span>
 </div>
 <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
 </div>
 </div>
 </div>

 <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
 <Tile label="Dense" value={candidates.dense} />
 <Tile label="BM25" value={candidates.bm25} />
 <Tile label="Após fusão" value={candidates.afterFusion} />
 <Tile label="Após grafo" value={candidates.afterGraph} />
 <Tile label="Após rerank" value={candidates.afterRerank} />
 <Tile label="Final" value={candidates.final} highlight />
 </div>
 </div>
 );
}

function Tile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
 return (
 <div
 className={cn("rounded-lg border bg-background/40 p-2.5 text-center",
 highlight && "border-emerald-500/40 bg-emerald-500/10",
 )}
 >
 <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
 <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", highlight && "text-emerald-300")}>
 {value}
 </div>
 </div>
 );
}
