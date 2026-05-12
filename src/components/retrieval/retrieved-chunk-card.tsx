"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";

const PROVENANCE_TONE: Record<string, string> = {
 dense: "bg-sky-500/10 text-sky-300",
 bm25: "bg-emerald-500/10 text-emerald-300",
 graph_citation_in: "bg-rose-500/10 text-rose-300",
 graph_citation_out: "bg-fuchsia-500/10 text-fuchsia-300",
 rerank: "bg-indigo-500/10 text-indigo-300",
};

export function RetrievedChunkCard({ chunk, rank }: { chunk: LegalRetrievedChunk; rank: number }) {
 const [open, setOpen] = useState(false);
 const sb = chunk.scores;
 return (
 <article className="rounded-xl border bg-card/40 backdrop-blur-sm">
 <header className="flex items-start gap-3 p-4">
 <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 font-mono text-sm font-semibold tabular-nums text-foreground">
 {rank}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-baseline gap-2">
 <h3 className="truncate text-[14px] font-semibold text-foreground">
 {chunk.norm.identifier ?? chunk.norm.title}
 </h3>
 {chunk.fullPath && (
 <span className="rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
 {chunk.fullPath}
 </span>
 )}
 </div>
 <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{chunk.norm.urn}</p>
 <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">
 {chunk.text}
 </p>
 </div>
 <div className="flex shrink-0 flex-col items-end gap-1">
 <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-emerald-300">
 {(sb.final * 100).toFixed(0)}
 </span>
 <button
 onClick={() => setOpen((o) => !o)}
 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
 >
 {open ? (
 <>
 ocultar <ChevronUp className="inline size-3" />
 </>
 ) : (
 <>
 explicar <ChevronDown className="inline size-3" />
 </>
 )}
 </button>
 </div>
 </header>

 {open && (
 <div className="space-y-3 border-t border-[color:var(--border-subtle)] p-4">
 <div className="flex flex-wrap gap-1.5">
 {chunk.provenance.map((p) => (
 <span
 key={p}
 className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
 PROVENANCE_TONE[p] ?? "bg-muted/40 text-muted-foreground",
 )}
 >
 {p.replace(/_/g, " ")}
 </span>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
 {sb.dense !== undefined && <Metric label="dense" value={sb.dense} />}
 {sb.bm25 !== undefined && <Metric label="bm25" value={sb.bm25} />}
 {sb.rrf !== undefined && <Metric label="rrf" value={sb.rrf} />}
 {sb.rerank !== undefined && <Metric label="rerank" value={sb.rerank} />}
 {sb.boost !== undefined && <Metric label="boost" value={sb.boost} mono />}
 </div>

 <details className="rounded-lg border bg-background/40 p-2">
 <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
 Justificativa
 </summary>
 <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
 {chunk.explanation}
 </p>
 </details>

 <details className="rounded-lg border bg-background/40 p-2">
 <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
 <FileText className="mr-1 inline size-3" /> Texto integral
 </summary>
 <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
 {chunk.text}
 </p>
 </details>
 </div>
 )}
 </article>
 );
}

function Metric({ label, value, mono }: { label: string; value: number; mono?: boolean }) {
 return (
 <div className="rounded-md bg-background/40 p-1.5 text-center">
 <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
 <div className={cn("mt-0.5 text-[12px] font-semibold tabular-nums", mono && "font-mono")}>
 {value.toFixed(3)}
 </div>
 </div>
 );
}
