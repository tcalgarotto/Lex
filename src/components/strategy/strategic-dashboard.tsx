"use client";

import type { StrategicLegalAssessment } from "@/lib/legal/reasoning/strategic";
import { AlertTriangle, Scale, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function StrategicDashboard({ data }: { data: StrategicLegalAssessment }) {
  const tf = data.tribunalFavorability;
  const sev = data.contradictionSeverity;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Scale className="size-3.5" /> Favorabilidade tribunal
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{tf.targetTribunal ?? "órgão não filtrado"}</Badge>
          <Badge variant="secondary">{tf.verdict}</Badge>
          <span className="font-mono text-sm text-indigo-200">
            alinhamento {(tf.alignmentScore * 100).toFixed(0)}%
          </span>
        </div>
        <Progress value={Math.round(tf.alignmentScore * 100)} className="mt-2 h-2" />
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {tf.distribution.slice(0, 5).map((d) => (
            <li key={String(d.tribunal)}>
              {d.tribunal ?? "(sem sigla)"} — {d.count} · média {d.avgScore.toFixed(2)}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Shield className="size-3.5" /> Severidade de contradições
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          <span className="text-rose-300">alta {sev.alta}</span>
          <span className="text-amber-300">média {sev.media}</span>
          <span className="text-zinc-400">baixa {sev.baixa}</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="size-3.5" /> Lacunas de evidência
        </div>
        <ul className="space-y-2 text-xs">
          {data.evidenceGaps.slice(0, 6).map((g) => (
            <li key={g.id} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
              <span className="font-medium text-amber-100">{g.gapKind}</span>
              <p className="mt-0.5 text-muted-foreground">{g.suggestion}</p>
            </li>
          ))}
          {data.evidenceGaps.length === 0 ? (
            <li className="text-muted-foreground">Nenhuma lacuna heurística detectada.</li>
          ) : null}
        </ul>
      </Card>

      <Card className="p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Próximos passos processuais</div>
        <ol className="list-decimal space-y-1 pl-4 text-xs text-foreground">
          {data.proceduralNextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
