"use client";

/**
 * Divergence indicator — sinaliza divergência jurisprudencial.
 *
 * Mostra contagem de divergências + pulso visual em casos críticos.
 * Cor escala com `level`: low/medium/high.
 */

import { GitBranch, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DivergenceLevel = "none" | "low" | "medium" | "high";

export type DivergenceIndicatorProps = {
 level: DivergenceLevel;
 count: number;
 detail?: string;
 className?: string;
};

const LEVEL_CLASS: Record<DivergenceLevel, string> = {
 none: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
 low: "border-amber-400/30 bg-amber-400/10 text-amber-200",
 medium: "border-orange-400/40 bg-orange-400/10 text-orange-200",
 high: "border-rose-500/50 bg-rose-500/10 text-rose-200",
};

const LEVEL_LABEL: Record<DivergenceLevel, string> = {
 none: "Sem divergência",
 low: "Divergência baixa",
 medium: "Divergência relevante",
 high: "Divergência crítica",
};

export function DivergenceIndicator({
 level,
 count,
 detail,
 className,
}: DivergenceIndicatorProps) {
 const Icon = level === "high" ? AlertTriangle : GitBranch;
 return (
 <div
 className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
 LEVEL_CLASS[level],
 className,
 )}
 role="status"
 aria-label={LEVEL_LABEL[level]}
 >
 <Icon className={cn("size-4 mt-0.5", level === "high" && "animate-pulse")} />
 <div className="flex-1 space-y-0.5">
 <div className="font-medium">
 {LEVEL_LABEL[level]} <span className="font-mono opacity-70">· {count}</span>
 </div>
 {detail ? <div className="opacity-80">{detail}</div> : null}
 </div>
 </div>
 );
}
