import type { CaseTimelineEvent } from "@prisma/client";
import {
  FileSearch,
  FilePlus,
  ShieldAlert,
  ClipboardCheck,
  PenSquare,
  GitMerge,
  StickyNote,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const KIND_META: Record<
  string,
  { label: string; icon: typeof FileSearch; tone: string }
> = {
  CASE_CREATED: { label: "Caso criado", icon: FilePlus, tone: "text-emerald-300" },
  INTAKE_COMPLETED: { label: "Intake concluído", icon: ClipboardCheck, tone: "text-emerald-300" },
  RESEARCH_RUN: { label: "Pesquisa executada", icon: FileSearch, tone: "text-blue-300" },
  DRAFT_GENERATED: { label: "Minuta gerada", icon: PenSquare, tone: "text-indigo-300" },
  DRAFT_EDITED: { label: "Minuta editada", icon: PenSquare, tone: "text-indigo-300" },
  REVIEW_RUN: { label: "Review executada", icon: GitMerge, tone: "text-purple-300" },
  RISK_FLAGGED: { label: "Risco sinalizado", icon: ShieldAlert, tone: "text-amber-300" },
  STATUS_CHANGED: { label: "Status alterado", icon: Activity, tone: "text-slate-300" },
  NOTE: { label: "Anotação", icon: StickyNote, tone: "text-slate-300" },
};

export function CaseTimelineTab({ events }: { events: CaseTimelineEvent[] }) {
  if (!events.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Sem eventos na timeline.</Card>;
  }
  return (
    <ol className="space-y-2">
      {events.map((e) => {
        const meta = KIND_META[e.kind] ?? { label: e.kind, icon: Activity, tone: "text-slate-300" };
        const Icon = meta.icon;
        return (
          <li key={e.id}>
            <Card className="p-3">
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-4 shrink-0 ${meta.tone}`} />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {meta.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm">{e.message}</p>
                  {e.retrievalChunkIds.length ? (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      retrieval: {e.retrievalChunkIds.length} chunks
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
