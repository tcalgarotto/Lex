"use client";

import { ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalRetrievalTrace } from "@/lib/retrieval/legal/types";

export function ReasoningTrace({ trace, rewrites }: { trace: LegalRetrievalTrace; rewrites: string[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card/40 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="size-3.5" />
            Pipeline ({trace.stages.length} estágios)
          </h4>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {trace.totalLatencyMs}ms total
          </span>
        </div>
        <ol className="mt-3 space-y-1.5">
          {trace.stages.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="text-[12px] font-medium text-foreground">{s.stage}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {s.latencyMs}ms
              </span>
              {s.detail && (
                <span className="ml-auto truncate text-[10px] text-muted-foreground">
                  {summarizeDetail(s.detail)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border bg-card/40 p-4 backdrop-blur-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reformulações de query ({rewrites.length})
        </h4>
        <ul className="mt-2 space-y-1.5">
          {rewrites.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  i === 0 ? "bg-indigo-500/15 text-indigo-300" : "bg-slate-500/15 text-slate-300",
                )}
              >
                {i + 1}
              </span>
              <span className="text-[12px] text-foreground">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border bg-card/40 p-4 backdrop-blur-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trace ID
        </h4>
        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{trace.traceId}</p>
      </div>
    </div>
  );
}

function summarizeDetail(d: Record<string, unknown>): string {
  if (typeof d["error"] === "string") return `err: ${d["error"]}`;
  if (typeof d["variant"] === "string") return `q: ${(d["variant"] as string).slice(0, 40)}`;
  return Object.entries(d)
    .slice(0, 2)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v).slice(0, 30) : v}`)
    .join(" ");
}
