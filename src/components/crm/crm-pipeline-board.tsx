"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CrmPipelineStage } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import type { CrmPipelineContactCard } from "@/lib/justos/crm/pipeline-service";

const STAGE_LABELS: Record<CrmPipelineStage, string> = {
  NEW: "Novo",
  QUALIFIED: "Qualificado",
  ACTIVE: "Ativo",
  WAITING_CLIENT: "Aguardando cliente",
  PROPOSAL: "Proposta",
  WON: "Ganho",
  LOST: "Perdido",
  ARCHIVED: "Arquivado",
};

type Props = {
  contactsByStage: Record<CrmPipelineStage, CrmPipelineContactCard[]>;
  stages: Array<{ stage: CrmPipelineStage; count: number }>;
};

export function CrmPipelineBoard({ contactsByStage, stages }: Props) {
  const router = useRouter();
  const [moving, setMoving] = useState<string | null>(null);

  async function moveContact(contactId: string, pipelineStage: CrmPipelineStage) {
    setMoving(contactId);
    try {
      await fetch(`/api/crm/contacts/${contactId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage }),
      });
      router.refresh();
    } finally {
      setMoving(null);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map(({ stage, count }) => (
        <div
          key={stage}
          className="min-w-[220px] flex-shrink-0 rounded-lg border bg-muted/30 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
            <Badge variant="outline">{count}</Badge>
          </div>
          <ul className="space-y-2">
            {(contactsByStage[stage] ?? []).map((c) => (
              <li key={c.id} className="rounded-md border bg-background p-2 text-sm">
                <p className="font-medium leading-tight">{c.displayName}</p>
                {c.phoneE164 ? (
                  <p className="text-xs text-muted-foreground">{c.phoneE164}</p>
                ) : null}
                <select
                  className="mt-2 w-full rounded border bg-background px-1 py-0.5 text-xs"
                  disabled={moving === c.id}
                  value={stage}
                  onChange={(e) =>
                    void moveContact(c.id, e.target.value as CrmPipelineStage)
                  }
                >
                  {Object.entries(STAGE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      → {label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
