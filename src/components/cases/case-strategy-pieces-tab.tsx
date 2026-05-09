"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Loader2, Sparkles, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  CaseDraft,
  CaseFact,
  CaseRequest,
  CaseReview,
  CaseRisk,
} from "@prisma/client";
import { CaseDraftsTab } from "./case-drafts-tab";
import { CaseReviewTab } from "./case-review-tab";

interface Props {
  caseId: string;
  facts: CaseFact[];
  requests: CaseRequest[];
  risks: CaseRisk[];
  drafts: CaseDraft[];
  reviews: CaseReview[];
  /**
   * Estratégia consolidada armazenada em `Case.metadataJson.strategy`
   * (preenchida por `POST /api/cases/[id]/strategy`).
   */
  strategy: CaseStrategyView | null;
}

export type CaseStrategyView = {
  thesis: string;
  arguments: Array<{
    id: string;
    headline: string;
    excerpt: string;
    evidence?: { chunkIds: string[]; normUrns: string[] };
    weight?: number;
  }>;
  counterArguments: Array<{
    headline: string;
    detail: string;
    severity: "alta" | "media" | "baixa" | string;
  }>;
  nextSteps: string[];
  badge?: string;
  generatedAt?: string | Date;
};

/**
 * Aba "Estratégia & Peças": agora EMBUTE a estratégia (não tira mais o
 * usuário do caso para `/strategy`). O laboratório `/strategy` continua
 * disponível como link discreto em "Avançado".
 *
 * O botão "Gerar/atualizar estratégia" chama `POST /api/cases/[id]/strategy`,
 * que persiste o resultado em `Case.metadataJson.strategy` e dispara um
 * `CaseTimelineEvent { kind: STRATEGY_GENERATED }`.
 */
export function CaseStrategyPiecesTab({
  caseId,
  facts,
  requests,
  risks,
  drafts,
  reviews,
  strategy,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = facts.length > 0 && requests.length > 0;
  const hasDraft = drafts.length > 0;
  const hasReview = reviews.length > 0;
  const lastDraftAt = drafts[0]?.createdAt;

  async function generateStrategy() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/strategy`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `falha ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const checklist: Array<{ label: string; done: boolean }> = [
    { label: `Fatos extraídos (${facts.length})`, done: facts.length > 0 },
    { label: `Pedidos definidos (${requests.length})`, done: requests.length > 0 },
    { label: `Riscos sinalizados (${risks.length})`, done: risks.length > 0 },
    { label: `Estratégia consolidada`, done: !!strategy },
    { label: `Peça gerada (${drafts.length})`, done: hasDraft },
    { label: `Revisão executada (${reviews.length})`, done: hasReview },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Estratégia &amp; Peças
            </p>
            <p className="text-sm">
              {hasDraft
                ? `Última peça ${lastDraftAt ? `gerada ${new Date(lastDraftAt).toLocaleDateString("pt-BR")}` : "disponível"}. Gere uma nova versão se houver novos fatos/fundamentos.`
                : ready
                  ? "Há fatos e pedidos suficientes para consolidar a estratégia e gerar a primeira peça."
                  : "Adicione fatos e pedidos antes de consolidar a estratégia."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={generateStrategy}
            disabled={busy || !ready}
            data-testid="case-strategy-generate"
          >
            {busy ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-3" />
            )}
            {strategy ? "Atualizar estratégia" : "Gerar estratégia"}
          </Button>
        </div>
        <ul className="mt-3 space-y-1 text-[11px]">
          {checklist.map((c) => (
            <li
              key={c.label}
              className={`flex items-center gap-1.5 ${c.done ? "text-emerald-200" : "text-muted-foreground"}`}
            >
              {c.done ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
              {c.label}
            </li>
          ))}
        </ul>
        {error ? (
          <p className="mt-2 text-[11px] text-rose-300">{error}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-end">
          <Button asChild variant="ghost" size="sm" className="text-[11px] text-muted-foreground">
            <Link href={`/strategy?caseId=${caseId}`}>
              <FlaskConical className="mr-1 size-3" />
              Abrir no Laboratório <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
      </Card>

      {strategy ? <StrategyPanel strategy={strategy} /> : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Peças · {drafts.length}
        </h3>
        <CaseDraftsTab caseId={caseId} drafts={drafts} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Revisões · {reviews.length}
        </h3>
        <CaseReviewTab reviews={reviews} />
      </section>
    </div>
  );
}

function StrategyPanel({ strategy }: { strategy: CaseStrategyView }) {
  return (
    <Card className="space-y-4 p-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tese principal</p>
        <p className="text-sm leading-relaxed text-foreground">{strategy.thesis}</p>
        {strategy.badge ? (
          <Badge variant="outline" className="text-[10px]">
            {strategy.badge}
          </Badge>
        ) : null}
      </header>

      {strategy.arguments.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Argumentos centrais ({strategy.arguments.length})
          </p>
          <ul className="space-y-2">
            {strategy.arguments.map((a) => (
              <li key={a.id} className="rounded-md border border-white/5 bg-white/[0.02] p-3">
                <p className="text-sm font-medium">{a.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.excerpt}</p>
                {a.evidence?.normUrns?.length ? (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {a.evidence.normUrns.slice(0, 3).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strategy.counterArguments.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contra-argumentos / riscos ({strategy.counterArguments.length})
          </p>
          <ul className="space-y-2">
            {strategy.counterArguments.map((ca, idx) => (
              <li
                key={`${ca.headline}-${idx}`}
                className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3"
              >
                <p className="text-sm font-medium text-amber-200">{ca.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/80">{ca.detail}</p>
                <Badge variant="outline" className="mt-1 text-[10px] uppercase tracking-wide">
                  {ca.severity}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strategy.nextSteps.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Próximos passos sugeridos
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {strategy.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {strategy.generatedAt ? (
        <p className="text-[10px] text-muted-foreground">
          Gerada {new Date(strategy.generatedAt).toLocaleString("pt-BR")}
        </p>
      ) : null}
    </Card>
  );
}
