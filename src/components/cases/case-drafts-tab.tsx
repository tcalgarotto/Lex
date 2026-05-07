"use client";

import { useState } from "react";
import type { CaseDraft } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CaseDraftsTab({ drafts }: { drafts: CaseDraft[] }) {
  const [openVersion, setOpenVersion] = useState<number | null>(drafts[0]?.version ?? null);
  if (!drafts.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Nenhuma minuta gerada ainda.</Card>;
  }
  const current = drafts.find((d) => d.version === openVersion) ?? drafts[0]!;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {drafts.map((d) => (
          <Button
            key={d.id}
            variant={d.version === current.version ? "default" : "outline"}
            size="sm"
            onClick={() => setOpenVersion(d.version)}
            className="text-xs"
          >
            v{d.version} · {d.status}
          </Button>
        ))}
      </div>
      <Card className="p-4">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            v{current.version}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {current.status}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {current.groundingChunkIds.length} fontes
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {new Date(current.createdAt).toLocaleString("pt-BR")}
          </span>
        </header>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
          {current.content}
        </pre>
      </Card>
    </div>
  );
}
