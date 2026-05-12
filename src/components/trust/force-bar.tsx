"use client";

/**
 * Visualização de força argumentativa (0..1) — barra horizontal segmentada.
 * 4 segmentos = 0–25 / 26–50 / 51–75 / 76–100 acendem progressivamente.
 *
 * Uso:
 * <ForceBar value={0.72} label="Tese principal" />
 *
 * Determinístico: visual depende exclusivamente do valor. Sem efeitos.
 */

import { cn } from "@/lib/utils";

export type ForceBarProps = {
 value: number;
 label?: string;
 /** Sublabel curto à direita (ex.: "alta"). */
 hint?: string;
 size?: "sm" | "md";
 className?: string;
};

function clamp01(n: number): number {
 if (Number.isNaN(n)) return 0;
 return Math.min(1, Math.max(0, n));
}

const TONE = [
 "bg-rose-500/30 ring-rose-500/40",
 "bg-amber-500/30 ring-amber-500/40",
 "bg-emerald-400/30 ring-emerald-400/40",
 "bg-indigo-400/40 ring-indigo-400/50",
] as const;

export function ForceBar({
 value,
 label,
 hint,
 size = "md",
 className,
}: ForceBarProps) {
 const v = clamp01(value);
 const lit = Math.ceil(v * 4); // 0..4
 const sizeCls = size === "sm" ? "h-1.5" : "h-2";

 return (
 <div className={cn("flex flex-col gap-1", className)} aria-label={label ?? "força argumentativa"}>
 {label ? (
 <div className="flex items-center justify-between text-[11px] text-muted-foreground">
 <span className="truncate">{label}</span>
 <span className="font-mono tabular-nums">{Math.round(v * 100)}%{hint ? ` · ${hint}` : ""}</span>
 </div>
 ) : null}
 <div className={cn("grid grid-cols-4 gap-1 rounded-full", sizeCls)} role="progressbar"
 aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
 {Array.from({ length: 4 }).map((_, i) => (
 <div
 key={i}
 className={cn("rounded-full ring-1 transition-all",
 sizeCls,
 i < lit ? TONE[i] : "bg-muted/30 ring-muted/20",
 )}
 />
 ))}
 </div>
 </div>
 );
}
