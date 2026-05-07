import type { CaseReview } from "@prisma/client";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type ChecklistItem = {
  id: string;
  title: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  weight: number;
};

const STATUS_ICON = {
  pass: { icon: CheckCircle2, tone: "text-emerald-300" },
  warning: { icon: AlertCircle, tone: "text-amber-300" },
  fail: { icon: XCircle, tone: "text-rose-300" },
} as const;

export function CaseReviewTab({ reviews }: { reviews: CaseReview[] }) {
  if (!reviews.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Nenhuma review executada.</Card>;
  }
  const last = reviews[0]!;
  const items = (last.checklistJson as unknown as ChecklistItem[]) ?? [];
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{last.verdict}</h3>
          <span className="font-mono text-sm text-muted-foreground">{last.score.toFixed(2)}</span>
        </div>
        <Progress value={Math.round(last.score * 100)} className="mt-2 h-2" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {new Date(last.createdAt).toLocaleString("pt-BR")}
        </p>
      </Card>
      <div className="space-y-2">
        {items.map((item) => {
          const { icon: Icon, tone } = STATUS_ICON[item.status] ?? STATUS_ICON.pass;
          return (
            <Card key={item.id} className="p-3">
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
