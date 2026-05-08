import { notFound } from "next/navigation";
import { Sparkles, Calendar, Building2, Hash } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getCaseById } from "@/lib/cases/repository";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import { CaseActions } from "@/components/cases/case-actions";
import { CaseTabs } from "@/components/cases/case-tabs";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  INTAKE: "Intake",
  RESEARCH: "Pesquisa",
  DRAFTING: "Drafting",
  REVIEW: "Review",
  READY: "Pronto",
  FILED: "Protocolado",
  CLOSED: "Encerrado",
  ARCHIVED: "Arquivado",
};

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await getCaseById(workspaceId, id);
  if (!c) notFound();

  const tribunal = c.tribunalCode ? getTribunal(c.tribunalCode) : null;

  return (
    <AppShell title={c.title}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
              {STATUS_LABEL[c.status] ?? c.status}
            </Badge>
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
            <CaseActions caseId={c.id} />
          </div>
        </header>

        <CaseTabs caseData={c} />

        <Card className="p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Auditável por design.</strong> Todas as gerações (intake,
          retrieval, drafting, review) ficam registradas na timeline do caso, com referências cruzadas a
          chunks normativos, traceIds e usuário responsável.
        </Card>
      </div>
    </AppShell>
  );
}
