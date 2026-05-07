import type { CaseFact } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORY_TONE: Record<string, string> = {
  data: "border-blue-500/30 text-blue-200 bg-blue-500/5",
  dano: "border-rose-500/30 text-rose-200 bg-rose-500/5",
  conduta: "border-amber-500/30 text-amber-200 bg-amber-500/5",
  vinculo: "border-emerald-500/30 text-emerald-200 bg-emerald-500/5",
  valor: "border-purple-500/30 text-purple-200 bg-purple-500/5",
  mora: "border-orange-500/30 text-orange-200 bg-orange-500/5",
  tutela: "border-indigo-500/30 text-indigo-200 bg-indigo-500/5",
};

export function CaseFactsTab({ facts }: { facts: CaseFact[] }) {
  if (!facts.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Nenhum fato extraído ainda.</Card>;
  }
  return (
    <div className="space-y-2">
      {facts.map((f) => (
        <Card key={f.id} className="p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px]">
              {String(f.ordinal).padStart(2, "0")}
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-sm leading-relaxed">{f.text}</p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {f.category ? (
                  <Badge variant="outline" className={CATEGORY_TONE[f.category] ?? ""}>
                    {f.category}
                  </Badge>
                ) : null}
                {f.dates.map((d) => (
                  <Badge key={d} variant="outline" className="font-mono text-[10px]">
                    {d}
                  </Badge>
                ))}
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                  conf {f.confidence.toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
