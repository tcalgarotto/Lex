import { notFound } from "next/navigation";
import { Sparkles, Calendar, Building2, Hash, Clock } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getCaseById } from "@/lib/cases/repository";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import { CaseActions } from "@/components/cases/case-actions";
import { CaseTabs, type CaseTabKey } from "@/components/cases/case-tabs";
import { caseStatusLabel, isCasePreProcessual } from "@/lib/cases/labels";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";

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

export const dynamic = "force-dynamic";

const CASE_TAB_KEYS = new Set([
  "overview",
  "documents",
  "facts",
  "research",
  "strategy",
  "checklist",
  "activity",
]);

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const tabRaw = typeof sp.tab === "string" ? sp.tab : undefined;
  const initialTab =
    tabRaw && CASE_TAB_KEYS.has(tabRaw) ? (tabRaw as CaseTabKey) : undefined;
  const { workspaceId } = await getWorkspaceContext();
  const c = await getCaseById(workspaceId, id);
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
                <Clock className="mr-1 size-3" /> Pré-processual
              </Badge>
            ) : null}
            {tribunal ? (
              <Badge variant="outline" className="text-[10px]">
                <Building2 className="mr-1 size-3" /> {tribunal.code} · {tribunal.name}
              </Badge>
            ) : null}
            {c.uf ? <Badge variant="outline" className="text-[10px]">{c.uf}</Badge> : null}
            {c.processNumber ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                <Hash className="mr-1 size-3" />
                {c.processNumber}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[10px]">
              <Calendar className="mr-1 size-3" />
              {new Date(c.createdAt).toLocaleDateString("pt-BR")}
            </Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" /> Caso
              </div>
              <h1 className="text-2xl font-semibold leading-tight">{c.title}</h1>
              {c.summary ? (
                <p className="max-w-3xl text-sm text-muted-foreground">{c.summary}</p>
              ) : null}
            </div>
            <CaseActions caseId={c.id} readiness={readiness} />
          </div>
        </header>

        <CaseTabs caseData={c} initialTab={initialTab} />

        <Card className="p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Auditável por design.</strong> Todas as ações no caso —
          coleta inicial, pesquisa de fundamentos, geração e revisão de peças — ficam registradas
          na aba Atividade, com referências cruzadas aos fundamentos normativos consultados e ao
          usuário responsável.
        </Card>
      </div>
    </AppShell>
  );
}
