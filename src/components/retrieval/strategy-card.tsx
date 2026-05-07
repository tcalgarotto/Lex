"use client";

import { Lightbulb, Quote, Scale, ShieldCheck, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";

const SEVERITY_TO_TONE = {
  alta: { bg: "bg-rose-500/10", text: "text-rose-300", border: "border-rose-500/30" },
  media: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30" },
  baixa: { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/30" },
} as const;

export function StrategyCard({ strategy }: { strategy: StrategySynthesis }) {
  return (
    <div className="rounded-xl border bg-card/40 p-5 backdrop-blur-sm">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-300">
          <Lightbulb className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
            Tese
          </div>
          <p className="mt-0.5 text-base font-medium text-foreground">{strategy.thesis}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{strategy.badge}</p>
        </div>
      </header>

      {strategy.arguments.length > 0 && (
        <section className="mt-4 space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Quote className="size-3.5" />
            Argumentos centrais
          </h4>
          <ul className="space-y-2">
            {strategy.arguments.map((a) => (
              <li key={a.id} className="rounded-lg border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-foreground">{a.headline}</p>
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-300">
                    {(a.weight * 100).toFixed(0)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{a.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {strategy.counterArguments.length > 0 && (
        <section className="mt-4 space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Scale className="size-3.5" />
            Riscos & contradições
          </h4>
          <ul className="space-y-2">
            {strategy.counterArguments.map((c, i) => {
              const tone = SEVERITY_TO_TONE[c.severity] ?? SEVERITY_TO_TONE.baixa;
              return (
                <li
                  key={i}
                  className={cn("rounded-lg border bg-background/40 p-3", tone.border)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-foreground">{c.headline}</p>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        tone.bg,
                        tone.text,
                      )}
                    >
                      {c.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{c.detail}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {strategy.nextSteps.length > 0 && (
        <section className="mt-4 space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ListOrdered className="size-3.5" />
            Próximos passos
          </h4>
          <ol className="space-y-1.5 pl-1">
            {strategy.nextSteps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-foreground">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[10px] font-semibold text-indigo-300">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {strategy.arguments.length === 0 && strategy.counterArguments.length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Sem argumentos suficientes — refine a query.
        </div>
      )}
    </div>
  );
}
