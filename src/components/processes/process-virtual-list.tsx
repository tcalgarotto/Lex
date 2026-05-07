"use client";

import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";

export function ProcessVirtualList(props: {
  items: { id: string; number: string; title: string | null; tags: string[] }[];
}) {
  const { items } = props;
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (): number => 72,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="h-[420px] overflow-auto rounded-xl border border-white/10">
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const p = items[virtualRow.index];
          if (!p) return null;
          return (
            <div
              key={p.id}
              className="absolute left-0 top-0 w-full border-b border-white/5 px-4 py-3"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <Link href={`/processos/${p.id}`} className="flex flex-col gap-1 hover:text-violet-300">
                <span className="font-medium">{p.title ?? p.number}</span>
                <span className="text-xs text-muted-foreground">{p.number}</span>
                <div className="flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
