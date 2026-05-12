"use client";

/**
 * Confidence meter — anel SVG circular para confiança 0..1.
 *
 * Cor por faixa:
 * < 0.4: rose
 * < 0.7: amber
 * ≥ 0.7: emerald
 *
 * Sem libs externas; SVG puro = ZERO impacto de bundle.
 */

import { cn } from "@/lib/utils";

export type ConfidenceMeterProps = {
 value: number;
 label?: string;
 size?: number;
 className?: string;
};

function clamp01(n: number): number {
 return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

function tone(value: number): { stroke: string; bg: string; text: string } {
 if (value < 0.4) return { stroke: "stroke-rose-400", bg: "stroke-rose-400/10", text: "text-rose-300" };
 if (value < 0.7) return { stroke: "stroke-amber-400", bg: "stroke-amber-400/10", text: "text-amber-300" };
 return { stroke: "stroke-emerald-400", bg: "stroke-emerald-400/10", text: "text-emerald-300" };
}

export function ConfidenceMeter({
 value,
 label,
 size = 72,
 className,
}: ConfidenceMeterProps) {
 const v = clamp01(value);
 const { stroke, bg, text } = tone(v);
 const radius = (size - 8) / 2;
 const circumference = 2 * Math.PI * radius;
 const offset = circumference * (1 - v);
 return (
 <div className={cn("flex items-center gap-3", className)}>
 <svg
 width={size}
 height={size}
 viewBox={`0 0 ${size} ${size}`}
 role="img"
 aria-label={`Confiança ${Math.round(v * 100)} por cento`}
 >
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius}
 className={cn("fill-none", bg)}
 strokeWidth={6}
 />
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius}
 className={cn("fill-none", stroke)}
 strokeWidth={6}
 strokeLinecap="round"
 strokeDasharray={circumference}
 strokeDashoffset={offset}
 transform={`rotate(-90 ${size / 2} ${size / 2})`}
 />
 <text
 x="50%"
 y="50%"
 textAnchor="middle"
 dominantBaseline="middle"
 className={cn("fill-current font-mono text-xs", text)}
 >
 {Math.round(v * 100)}%
 </text>
 </svg>
 {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
 </div>
 );
}
