"use client";

import type { ReasoningTreeNode } from "@/lib/legal/reasoning/explain-tree";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function TreeRow({
  node,
  depth,
}: {
  node: ReasoningTreeNode;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children && node.children.length > 0;

  return (
    <div className={cn("border-l border-white/10 pl-3", depth > 0 && "mt-1")}>
      <button
        type="button"
        onClick={() => hasKids && setOpen(!open)}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          hasKids && "hover:bg-white/5",
        )}
      >
        {hasKids ? (
          <ChevronRight className={cn("mt-0.5 size-4 shrink-0 transition-transform", open && "rotate-90")} />
        ) : (
          <span className="mt-0.5 inline-block w-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-medium text-foreground">{node.label}</span>
          {node.detail ? (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{node.detail}</span>
          ) : null}
          {typeof node.strength === "number" ? (
            <span className="mt-1 block font-mono text-[10px] text-indigo-300">
              força {node.strength.toFixed(2)}
            </span>
          ) : null}
        </span>
      </button>
      {hasKids && open ? (
        <div className="ml-2 border-l border-white/5 pl-2">
          {node.children!.map((ch) => (
            <TreeRow key={ch.id} node={ch} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReasoningTreePanel({ root }: { root: ReasoningTreeNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Árvore de raciocínio
      </h3>
      <TreeRow node={root} depth={0} />
    </div>
  );
}
