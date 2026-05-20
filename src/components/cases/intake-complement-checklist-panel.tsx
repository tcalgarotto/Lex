"use client";

import { cn } from "@/lib/utils";
import type { ComplementCheckItem } from "@/lib/cases/fundamental-intake/intake-complement-checklist";
import { Card } from "@/components/ui/card";

export function IntakeComplementChecklistPanel({
  items,
  compact,
}: {
  items: ComplementCheckItem[];
  /** Dentro da sidebar colapsável — sem card pesado. */
  compact?: boolean;
}) {
  const missing = items.filter((i) => i.status === "missing").length;
  const list = (
    <>
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Checklist da entrevista
        </p>
      ) : null}
      <p className={cn("text-xs text-muted-foreground", !compact && "mt-1")}>
        {missing > 0
          ? `${missing} tópico(s) sem resposta clara.`
          : "Tópicos essenciais cobertos."}
      </p>
      <ul className={cn("space-y-1.5", compact ? "mt-1 max-h-48 overflow-y-auto" : "mt-3 space-y-2")}>
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              compact ? "rounded px-1.5 py-1 text-xs" : "rounded-md border px-3 py-2 text-sm",
              !compact &&
                item.status === "answered" &&
                "border-emerald-500/30 bg-emerald-500/5",
              !compact && item.status === "partial" && "border-amber-500/30 bg-amber-500/5",
              !compact &&
                item.status === "missing" &&
                "border-[color:var(--border-subtle)] bg-white/[0.02]",
            )}
          >
            <div className="flex items-start justify-between gap-1.5">
              <span className={compact ? "leading-snug text-foreground/90" : "text-foreground"}>
                {item.question}
              </span>
              <StatusBadge status={item.status} compact={compact} />
            </div>
            {item.hint && !compact ? (
              <p className="mt-1 text-caption text-muted-foreground">{item.hint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );

  if (compact) return <div data-testid="intake-checklist-compact">{list}</div>;
  return <Card className="p-4">{list}</Card>;
}

function StatusBadge({
  status,
  compact,
}: {
  status: ComplementCheckItem["status"];
  compact?: boolean;
}) {
  const label =
    status === "answered" ? "Ok" : status === "partial" ? "Parcial" : "Pendente";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full font-medium uppercase",
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        status === "answered" && "bg-emerald-500/20 text-emerald-200",
        status === "partial" && "bg-amber-500/20 text-amber-200",
        status === "missing" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
