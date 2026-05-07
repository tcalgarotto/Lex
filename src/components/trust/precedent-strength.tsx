"use client";

/**
 * Precedent strength badge — visual rating de um precedente.
 *
 * `strength` é derivado de fatores objetivos:
 *  - tribunal hierarquicamente superior (STF/STJ)
 *  - quórum (maioria, plenário)
 *  - recência
 *  - ocorrência (quantos chunks reforçam o mesmo entendimento)
 *
 * Esse componente não computa — apenas renderiza um valor 0..1
 * + nome do tribunal + label.
 */

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type PrecedentStrengthProps = {
  strength: number;
  tribunal?: string | null;
  label?: string;
  className?: string;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

function tone(strength: number): string {
  if (strength >= 0.85) return "border-indigo-400/40 bg-indigo-400/10 text-indigo-200";
  if (strength >= 0.6) return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (strength >= 0.4) return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  return "border-muted/40 bg-muted/20 text-muted-foreground";
}

export function PrecedentStrength({
  strength,
  tribunal,
  label,
  className,
}: PrecedentStrengthProps) {
  const v = clamp01(strength);
  const stars = Math.round(v * 5);
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        tone(v),
        className,
      )}
      title={`Força do precedente: ${(v * 100).toFixed(0)}%`}
    >
      <span className="font-mono uppercase tracking-wide">{tribunal ?? "—"}</span>
      <span aria-hidden className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3",
              i < stars ? "fill-current" : "opacity-30",
            )}
          />
        ))}
      </span>
      {label ? <span className="opacity-80">{label}</span> : null}
    </div>
  );
}
