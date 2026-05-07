"use client";

import { Clock, BookOpen, Gavel, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormTimeline } from "@/lib/legal/reasoning/timeline";

const KIND_TO_ICON = {
  published: BookOpen,
  in_force: Clock,
  version: RefreshCw,
  amended: RefreshCw,
  revoked: Trash2,
} as const;

const KIND_TO_TONE = {
  published: "text-sky-300",
  in_force: "text-emerald-300",
  version: "text-amber-300",
  amended: "text-amber-300",
  revoked: "text-rose-300",
} as const;

export function LegalTimelineList({ timelines }: { timelines: NormTimeline[] }) {
  if (timelines.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">
        Sem normas indexadas para mapear vigências.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {timelines.map((t) => (
        <NormTimelineCard key={t.norm.id} timeline={t} />
      ))}
    </div>
  );
}

function NormTimelineCard({ timeline }: { timeline: NormTimeline }) {
  const t = timeline;
  return (
    <article className="rounded-xl border bg-card/40 p-4 backdrop-blur-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t.norm.identifier ?? t.norm.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{t.norm.urn}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {t.summary.isCurrent ? (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
              Em vigor
            </span>
          ) : (
            <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-300">
              Não vigente
            </span>
          )}
          {t.summary.publishedAt && (
            <span className="text-[11px] text-muted-foreground">desde {t.summary.publishedAt}</span>
          )}
        </div>
      </header>

      <ol className="mt-3 space-y-2 border-l border-white/10 pl-4">
        {t.events.length === 0 && (
          <li className="text-xs text-muted-foreground">Sem eventos cronológicos detectados.</li>
        )}
        {t.events.map((e, i) => {
          const Icon = KIND_TO_ICON[e.kind] ?? Gavel;
          const tone = KIND_TO_TONE[e.kind] ?? "text-muted-foreground";
          return (
            <li key={i} className="relative">
              <span
                className={cn(
                  "absolute -left-[21px] top-1 inline-flex size-3.5 items-center justify-center rounded-full bg-background ring-1 ring-white/15",
                )}
              >
                <Icon className={cn("size-2.5", tone)} />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {e.date === "0000-00-00" ? "—" : e.date}
                </span>
                <span className="text-xs font-medium text-foreground">{e.label}</span>
              </div>
              {e.detail && <p className="mt-0.5 text-[12px] text-muted-foreground">{e.detail}</p>}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
