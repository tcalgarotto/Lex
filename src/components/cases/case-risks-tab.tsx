import type { CaseRisk } from "@prisma/client";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SEVERITY_TONE: Record<string, { tone: string; icon: typeof ShieldAlert }> = {
  CRITICAL: { tone: "border-rose-500/40 text-rose-300 bg-rose-500/10", icon: ShieldAlert },
  HIGH: { tone: "border-rose-500/30 text-rose-200 bg-rose-500/5", icon: ShieldAlert },
  MEDIUM: { tone: "border-amber-500/30 text-amber-200 bg-amber-500/5", icon: AlertTriangle },
  LOW: { tone: "border-blue-500/30 text-blue-200 bg-blue-500/5", icon: Info },
};

const KIND_LABEL: Record<string, string> = {
  REVOKED_NORM: "Norma revogada",
  PRECEDENT_DIVERGENCE: "Divergência jurisprudencial",
  HISTORIC_VERSION: "Versão histórica",
  MISSING_GROUNDING: "Lacuna de fundamentação",
  WEAK_ARGUMENT: "Argumento frágil",
  PROCEDURAL_GAP: "Lacuna processual",
  OTHER: "Outro risco",
};

export function CaseRisksTab({ risks }: { risks: CaseRisk[] }) {
  if (!risks.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Sem riscos identificados.</Card>;
  }
  return (
    <div className="space-y-2">
      {risks.map((r) => {
        const meta = SEVERITY_TONE[r.severity] ?? SEVERITY_TONE["LOW"]!;
        const Icon = meta.icon;
        return (
          <Card key={r.id} className={`p-3 ${meta.tone}`}>
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {r.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </Badge>
                </div>
                <h3 className="text-sm font-medium">{r.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                {r.evidenceNormUrns.length ? (
                  <p className="break-all font-mono text-[10px] text-muted-foreground">
                    {r.evidenceNormUrns.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
