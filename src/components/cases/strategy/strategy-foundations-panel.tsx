/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FoundationVerificationStatus } from "@/lib/legal-research/types";

type Source = {
  id: string;
  chunkId: string;
  normUrn: string | null;
  articleRef: string | null;
  excerpt: string;
};

type Props = {
  caseId: string;
  onInsert: (snippet: string) => void;
  onChanged: () => Promise<void>;
};

function badgeFor(status: FoundationVerificationStatus) {
  if (status === "AI_RECOMMENDED_UNVERIFIED") {
    return (
      <Badge variant="outline" className="border-rose-500/60 text-rose-100">
        Indicação automática
      </Badge>
    );
  }
  if (status === "VERIFIED_BY_INTERNAL_RAG" || status === "VERIFIED_BY_OFFICIAL_SOURCE") {
    return <Badge variant="secondary">Verificado</Badge>;
  }
  return <Badge variant="default">Pin do escritório</Badge>;
}

export function StrategyFoundationsPanel({ caseId, onInsert, onChanged }: Props) {
  const [sources, setSources] = useState<Source[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/legal-sources`);
    const data = await res.json();
    if (!res.ok) return;
    setSources(data.sources ?? []);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/cases/${caseId}/legal-sources?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao remover");
      toast.success("Fundamento removido do caso.");
      await load();
      await onChanged();
    } catch {
      toast.error("Não foi possível remover.");
    }
  }

  return (
    <div className="space-y-2">
      {sources.length === 0 ? (
        <Card className="p-3 text-sm text-muted-foreground">
          Nenhum fundamento fixado ainda. Use a aba de pesquisa jurídica para pinar trechos.
        </Card>
      ) : null}
      {sources.map((s) => {
        const status: FoundationVerificationStatus = "USER_PINNED";
        return (
          <Card key={s.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookMarked className="size-4 text-muted-foreground" />
                <span className="line-clamp-2">{s.articleRef ?? s.normUrn ?? "Fundamento"}</span>
              </div>
              {badgeFor(status)}
            </div>
            <p className="line-clamp-4 text-xs text-muted-foreground">{s.excerpt}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  onInsert(
                    `\n> **Fundamento pinado** (${s.articleRef ?? s.normUrn ?? s.chunkId})\n> ${s.excerpt.slice(0, 800)}${s.excerpt.length > 800 ? "…" : ""}\n`,
                  )
                }
              >
                <Plus className="size-3.5" />
                Inserir no texto
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onInsert(` [ref pin ${s.id}]`)}>
                <Pin className="size-3.5" />
                Fixar como referência
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s.id)}>
                <Trash2 className="size-3.5" />
                Remover
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
