import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
}

/**
 * Aba agrupada "Estratégia & Peças": combina rascunhos (CaseDraft), revisão
 * (CaseReview) e atalho para o laboratório de estratégia (`/strategy`).
 *
 * NÃO duplica lógica de geração — chama o endpoint existente
 * `/api/strategy/analyze?caseId=...` quando o usuário clica em "Gerar/atualizar".
 */
export function CaseStrategyPiecesTab({
  caseId,
  facts,
  requests,
  risks,
  drafts,
  reviews,
}: Props) {
  const ready = facts.length > 0 && requests.length > 0;
  const hasDraft = drafts.length > 0;
  const hasReview = reviews.length > 0;
  const lastDraftAt = drafts[0]?.createdAt;

  const checklist: Array<{ label: string; done: boolean }> = [
    { label: `Fatos extraídos (${facts.length})`, done: facts.length > 0 },
    { label: `Pedidos definidos (${requests.length})`, done: requests.length > 0 },
    { label: `Riscos sinalizados (${risks.length})`, done: risks.length > 0 },
    { label: `Estratégia/minuta gerada (${drafts.length})`, done: hasDraft },
    { label: `Revisão IA executada (${reviews.length})`, done: hasReview },
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
                ? `Última minuta ${lastDraftAt ? `gerada ${new Date(lastDraftAt).toLocaleDateString("pt-BR")}` : "disponível"}. Gere uma nova versão se houver novos fatos/fundamentos.`
                : ready
                  ? "Há fatos e pedidos suficientes para gerar a primeira minuta."
                  : "Adicione fatos e pedidos antes de gerar a primeira minuta."}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/strategy?caseId=${caseId}`}>
              <Sparkles className="mr-1 size-3" />
              {hasDraft ? "Atualizar estratégia" : "Abrir estratégia"}
              <ArrowRight className="ml-1 size-3" />
            </Link>
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
      </Card>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Minutas · {drafts.length}
        </h3>
        <CaseDraftsTab drafts={drafts} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reviews · {reviews.length}
        </h3>
        <CaseReviewTab reviews={reviews} />
      </section>
    </div>
  );
}
