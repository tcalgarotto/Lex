/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Sparkles, Calendar, Building2, Hash, Clock } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import { CaseActions } from "@/components/cases/case-actions";
import { CaseSubnav } from "@/components/cases/case-subnav";
import { caseStatusLabel, isCasePreProcessual } from "@/lib/cases/labels";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import { loadCaseForWorkspace } from "./_load-case";
import { CaseLegacyQueryRedirect } from "@/components/cases/case-legacy-query-redirect";

export const dynamic = "force-dynamic";

function readReadiness(metadataJson: unknown): ProceduralReadiness | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const m = metadataJson as { brain?: { proceduralReadiness?: unknown } };
  const r = m.brain?.proceduralReadiness;
  if (!r || typeof r !== "object") return null;
  const x = r as Partial<ProceduralReadiness>;
  if (typeof x.score !== "number" || typeof x.status !== "string") return null;
  return {
    score: x.score,
    status: x.status as ProceduralReadiness["status"],
    blockers: Array.isArray(x.blockers) ? x.blockers : [],
    missingDocuments: Array.isArray(x.missingDocuments) ? x.missingDocuments : [],
    nextBestAction: typeof x.nextBestAction === "string" ? x.nextBestAction : "",
    rationale: typeof x.rationale === "string" ? x.rationale : "",
  };
}

export default async function CaseDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await loadCaseForWorkspace(workspaceId, id);
  if (!c) notFound();

  const tribunal = c.tribunalCode ? getTribunal(c.tribunalCode) : null;
  const preProcessual = isCasePreProcessual(c);
  const readiness = readReadiness(c.metadataJson);

  return (
    <AppShell title={c.title}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {caseStatusLabel(c.status)}
            </Badge>
            {preProcessual ? (
              <Badge
                variant="outline"
                className="border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-200"
              >
                <Clock className="mr-1 size-3" aria-hidden /> Pré-processual
              </Badge>
            ) : null}
            {tribunal ? (
              <Badge variant="outline" className="text-[10px]">
                <Building2 className="mr-1 size-3" aria-hidden /> {tribunal.code} · {tribunal.name}
              </Badge>
            ) : null}
            {c.uf ? <Badge variant="outline" className="text-[10px]">{c.uf}</Badge> : null}
            {c.processNumber ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                <Hash className="mr-1 size-3" aria-hidden />
                {c.processNumber}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[10px]">
              <Calendar className="mr-1 size-3" aria-hidden />
              {new Date(c.createdAt).toLocaleDateString("pt-BR")}
            </Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" aria-hidden /> Caso
              </div>
              <h1 className="text-2xl font-semibold leading-tight">{c.title}</h1>
              {c.summary ? (
                <p className="max-w-3xl text-sm text-muted-foreground">{c.summary}</p>
              ) : null}
            </div>
            <CaseActions caseId={c.id} readiness={readiness} />
          </div>
        </header>

        <CaseSubnav caseId={c.id} />

        <Suspense fallback={null}>
          <CaseLegacyQueryRedirect caseId={c.id} />
        </Suspense>

        {children}

        <Card className="p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Auditável por design.</strong> Todas as ações no caso —
          coleta inicial, pesquisa de fundamentos, geração e revisão de peças — ficam registradas
          na seção Visão geral (atividades), com referências cruzadas aos fundamentos normativos
          consultados e ao usuário responsável.
        </Card>
      </div>
    </AppShell>
  );
}
