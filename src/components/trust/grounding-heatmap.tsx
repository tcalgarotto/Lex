"use client";

/**
 * Heatmap de fundamentação (grounding) por chunk.
 *
 * Cada célula é um chunk recuperado, cor proporcional ao score 0..1.
 * Determinístico: deriva apenas dos dados — nada de animação randômica.
 */

import { cn } from "@/lib/utils";

export type GroundingHeatmapItem = {
 chunkId: string;
 /** Score 0..1 (rerank/score combinado). */
 score: number;
 /** Texto curto opcional (tooltip). */
 label?: string;
 /** URN/identificador (tooltip secundário). */
 reference?: string;
};

export type GroundingHeatmapProps = {
 items: ReadonlyArray<GroundingHeatmapItem>;
 className?: string;
 /** Quantos por linha. Default 12. */
 columns?: number;
};

function shadeFor(score: number): string {
 const v = Math.min(1, Math.max(0, score));
 if (v < 0.2) return "bg-muted/30";
 if (v < 0.4) return "bg-indigo-500/20";
 if (v < 0.6) return "bg-indigo-500/40";
 if (v < 0.8) return "bg-indigo-500/60";
 return "bg-indigo-400/80";
}

export function GroundingHeatmap({
 items,
 className,
 columns = 12,
}: GroundingHeatmapProps) {
 if (!items.length) {
 return (
 <p className={cn("text-xs text-muted-foreground", className)}>
 Sem chunks recuperados para exibir.
 </p>
 );
 }
 return (
 <div
 className={cn("grid gap-1", className)}
 style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
 aria-label="grounding heatmap"
 >
 {items.map((it) => (
 <div
 key={it.chunkId}
 title={[
 `score ${(it.score * 100).toFixed(0)}%`,
 it.label,
 it.reference,
 ]
 .filter(Boolean)
 .join(" · ")}
 className={cn("h-3 w-full rounded-sm ring-1 ring-border/40 transition-colors",
 shadeFor(it.score),
 )}
 />
 ))}
 </div>
 );
}
