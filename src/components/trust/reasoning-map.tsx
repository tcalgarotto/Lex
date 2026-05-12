"use client";

/**
 * Reasoning map — mapa horizontal compacto do raciocínio.
 *
 * Diferente do `ReasoningTreePanel` (que é hierárquico expansível),
 * esse componente desenha uma "cadeia" Intent → Retrieval → Issues → Risks
 * → Strategy, com badges densos e contagens. Útil em headers/cards onde
 * espaço é caro.
 */

import {
 ArrowRight,
 Brain,
 GitBranch,
 Layers,
 ListChecks,
 Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ReasoningMapStep = {
 id: string;
 label: string;
 /** Contagem opcional (ex.: número de chunks). */
 count?: number;
 /** Tom (cor) da pílula. */
 tone?: "neutral" | "info" | "warning" | "danger" | "ok";
};

export type ReasoningMapProps = {
 steps: ReadonlyArray<ReasoningMapStep>;
 className?: string;
};

const TONE_CLASS: Record<NonNullable<ReasoningMapStep["tone"]>, string> = {
 neutral: "border-border/60 bg-muted/20 text-foreground",
 info: "border-indigo-400/40 bg-indigo-400/10 text-indigo-200",
 ok: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
 warning: "border-amber-400/40 bg-amber-400/10 text-amber-200",
 danger: "border-rose-500/50 bg-rose-500/10 text-rose-200",
};

const ICON_FOR_LABEL = (label: string) => {
 const lc = label.toLowerCase();
 if (lc.includes("intent")) return Brain;
 if (lc.includes("retriev")) return Layers;
 if (lc.includes("issue") || lc.includes("ponto")) return ListChecks;
 if (lc.includes("risk") || lc.includes("risc") || lc.includes("contra")) return GitBranch;
 if (lc.includes("strategy") || lc.includes("estrat")) return Target;
 return ArrowRight;
};

export function ReasoningMap({ steps, className }: ReasoningMapProps) {
 if (!steps.length) return null;
 return (
 <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}>
 {steps.map((s, i) => {
 const Icon = ICON_FOR_LABEL(s.label);
 return (
 <div key={s.id} className="flex items-center gap-1.5">
 <span
 className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
 TONE_CLASS[s.tone ?? "neutral"],
 )}
 >
 <Icon className="size-3" />
 <span className="truncate max-w-[12rem]">{s.label}</span>
 {typeof s.count === "number" ? (
 <span className="font-mono opacity-70">· {s.count}</span>
 ) : null}
 </span>
 {i < steps.length - 1 ? (
 <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
 ) : null}
 </div>
 );
 })}
 </div>
 );
}
