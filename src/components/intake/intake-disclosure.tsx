"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accordion leve para progressive disclosure na entrevista. */
export function IntakeDisclosure({
  title,
  children,
  defaultOpen = false,
  optional,
  className,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  optional?: boolean;
  className?: string;
}) {
  return (
    <details
      className={cn(
        "group rounded-lg border border-[color:var(--border-default)]/50 bg-white/[0.015]",
        optional && "border-dashed border-[color:var(--border-default)]/35",
        className,
      )}
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-[color:var(--text-primary)] [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {optional ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>
          ) : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-[color:var(--border-default)]/40 px-3 pb-3 pt-2">
        {children}
      </div>
    </details>
  );
}

export function IntakeEmptyHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-[color:var(--border-default)]/50 bg-white/[0.02] px-3 py-3 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
