"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LegalSearchPanel } from "@/components/legal-search/legal-search-panel";
import { CaseDataOriginButton } from "@/components/cases/case-data-origin";
import type { CaseLegalSource } from "@prisma/client";

interface Props {
  caseId: string;
  legalSources: CaseLegalSource[];
}

/**
 * Aba "Pesquisa jurídica" do caso. Exibe:
 *  - Fundamentos salvos no caso (CaseLegalSource) com botão de remoção;
 *  - Painel de busca embutido (`LegalSearchPanel`) com o caso pré-selecionado,
 *    permitindo adicionar novos fundamentos sem sair da tela do caso.
 */
export function CaseResearchTab({ caseId, legalSources }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unpin(id: string) {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/cases/${caseId}/legal-sources?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fundamentos do caso · {legalSources.length}
          </h3>
        </div>

        {error ? (
          <Card className="border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
            {error}
          </Card>
        ) : null}

        {legalSources.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum fundamento adicionado ao caso ainda.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use a busca abaixo para encontrar normas relevantes e clicar em
              &quot;Adicionar ao caso&quot;.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {legalSources.map((s) => (
              <li key={s.id}>
                <Card className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {s.articleRef ? (
                          <Badge variant="outline" className="text-[10px]">
                            {s.articleRef}
                          </Badge>
                        ) : null}
                        {s.normUrn ? (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {s.normUrn}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm leading-relaxed">{s.excerpt}</p>
                      {s.query ? (
                        <p className="text-[11px] text-muted-foreground">
                          Pesquisa: &quot;{s.query}&quot;
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <CaseDataOriginButton
                        kind="legalSource"
                        metadataJson={{
                          origin: "Fundamento fixado a partir da pesquisa jurídica",
                          source: s.query
                            ? `Busca: "${s.query}"`
                            : "Trecho indexado no acervo oficial (referência interna)",
                          sourceText: s.excerpt,
                          lastEditedAt: s.createdAt.toISOString(),
                          lastEditedById: s.pinnedById ?? undefined,
                        }}
                        createdAt={s.createdAt}
                        actorUserId={s.pinnedById}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remover do caso"
                        disabled={busy === s.id}
                        onClick={() => unpin(s.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-white/5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Search className="size-3" /> Buscar fundamentos
          </div>
          <Button asChild size="sm" variant="ghost" className="text-[11px] text-muted-foreground">
            <Link href={`/pesquisa-juridica?caseId=${caseId}`}>
              Ver em tela cheia <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
        <LegalSearchPanel embeddedCaseId={caseId} />
      </section>
    </div>
  );
}
