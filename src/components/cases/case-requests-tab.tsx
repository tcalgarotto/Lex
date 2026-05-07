import type { CaseRequest } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  MAIN: { label: "Principal", tone: "border-indigo-500/30 text-indigo-200 bg-indigo-500/5" },
  SUBSIDIARY: { label: "Subsidiário", tone: "border-purple-500/30 text-purple-200 bg-purple-500/5" },
  URGENCY: { label: "Tutela de Urgência", tone: "border-rose-500/30 text-rose-200 bg-rose-500/5" },
  PROVISIONAL: { label: "Provisório", tone: "border-orange-500/30 text-orange-200 bg-orange-500/5" },
  EVIDENCE: { label: "Provas", tone: "border-blue-500/30 text-blue-200 bg-blue-500/5" },
  PROCEDURAL: { label: "Processual", tone: "border-emerald-500/30 text-emerald-200 bg-emerald-500/5" },
  OTHER: { label: "Outro", tone: "" },
};

export function CaseRequestsTab({ requests }: { requests: CaseRequest[] }) {
  if (!requests.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Nenhum pedido extraído.</Card>;
  }
  return (
    <div className="space-y-2">
      {requests.map((r) => {
        const meta = KIND_LABEL[r.kind] ?? { label: r.kind, tone: "" };
        return (
          <Card key={r.id} className="p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px]">
                {String(r.ordinal).padStart(2, "0")}
              </span>
              <div className="flex-1 space-y-1">
                <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
                  {meta.label}
                </Badge>
                <p className="text-sm leading-relaxed">{r.text}</p>
                {r.legalBasisUrn ? (
                  <p className="font-mono text-[10px] text-muted-foreground">{r.legalBasisUrn}</p>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
