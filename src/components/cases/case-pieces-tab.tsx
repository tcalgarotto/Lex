"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { CaseDraft, CaseReview } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CaseDraftsTab } from "@/components/cases/case-drafts-tab";
import { CaseReviewTab } from "@/components/cases/case-review-tab";
import { caseCockpitHref } from "@/lib/cases/case-cockpit-routes";

type Props = {
  caseId: string;
  drafts: CaseDraft[];
  reviews: CaseReview[];
};

/**
 * Peças e minutas do caso — listagem e revisão. Geração/edição principal fica em Estratégia.
 */
export function CasePiecesTab({ caseId, drafts, reviews }: Props) {
  const estrategiaHref = caseCockpitHref(caseId, "estrategia");

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            {drafts.length > 0
              ? `${drafts.length} minuta(s) neste caso. Para gerar ou editar com o fluxo completo, use Estratégia.`
              : "Ainda não há minuta. Consolide fundamentos e gere a primeira versão em Estratégia."}
          </p>
        </div>
        <Button asChild size="sm" data-testid="case-pieces-go-estrategia">
          <Link href={estrategiaHref}>
            <Sparkles className="mr-1 size-3" aria-hidden />
            {drafts.length > 0 ? "Abrir editor na estratégia" : "Gerar primeira minuta"}
            <ArrowRight className="ml-1 size-3" aria-hidden />
          </Link>
        </Button>
      </Card>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Minutas · {drafts.length}
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
