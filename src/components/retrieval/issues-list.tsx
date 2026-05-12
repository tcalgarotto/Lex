"use client";

import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";

const CATEGORY_TO_TONE: Record<LegalIssue["category"], string> = {
 constitucional: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
 consumo: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
 civil: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
 processual: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
 penal: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
 trabalhista: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/30",
 tributario: "bg-orange-500/10 text-orange-300 ring-orange-500/30",
 administrativo: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
 diversos: "bg-[color:var(--surface-overlay)] text-[color:var(--text-secondary)] ring-[color:var(--border-default)]",
};

export function IssuesList({ issues }: { issues: LegalIssue[] }) {
 if (issues.length === 0) {
 return (
 <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[color:var(--border-default)] text-sm text-muted-foreground">
 Nenhuma issue jurídica detectada nesta consulta.
 </div>
 );
 }
 return (
 <ul className="space-y-2">
 {issues.map((i) => (
 <li
 key={i.id}
 className={cn("flex items-start justify-between gap-3 rounded-lg border bg-background/40 p-3 ring-1",
 CATEGORY_TO_TONE[i.category],
 )}
 >
 <div className="flex min-w-0 items-start gap-2.5">
 <Tag className="mt-0.5 size-4 shrink-0" />
 <div className="min-w-0">
 <p className="text-[13px] font-semibold text-foreground">{i.title}</p>
 <p className="mt-0.5 text-[11px] text-muted-foreground">
 <span className="uppercase tracking-wide">{i.category}</span>
 {" • "}
 {i.rationale}
 </p>
 {i.evidence.length > 0 && (
 <p className="mt-1 text-[10px] text-muted-foreground">
 {i.evidence.length} trecho(s) de evidência
 </p>
 )}
 </div>
 </div>
 <span className="shrink-0 rounded-md bg-background/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
 {(i.confidence * 100).toFixed(0)}%
 </span>
 </li>
 ))}
 </ul>
 );
}
