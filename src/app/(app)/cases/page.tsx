import Link from "next/link";
import { ArrowRight, Plus, FileText, ShieldAlert, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getWorkspaceContext } from "@/lib/auth/session";
import { listCases } from "@/lib/cases/repository";

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

export default async function CasesListPage() {
  const { workspaceId } = await getWorkspaceContext();
  const cases = await listCases(workspaceId, { take: 20 });

  return (
    <AppShell title="Casos">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5" /> Legal Workflow Automation
            </div>
            <h1 className="text-2xl font-semibold">Casos</h1>
            <p className="text-sm text-muted-foreground">
              Pipelines operacionais: intake estruturado, retrieval, drafting e review com auditoria total.
            </p>
          </div>
          <Button asChild>
            <Link href="/cases/new" className="inline-flex items-center gap-2">
              <Plus className="size-4" /> Novo caso
            </Link>
          </Button>
        </header>

        {cases.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Nenhum caso ainda"
            description="Cole o relato do cliente e o Lex extrai partes, fatos, pedidos, riscos e a estratégia inicial."
            action={{ label: "Criar primeiro caso", href: "/cases/new" }}
            fullHeight
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cases.map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

type CaseRow = Awaited<ReturnType<typeof listCases>>[number];

function CaseCard({ c }: { c: CaseRow }) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-colors hover:border-indigo-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
              {STATUS_LABEL[c.status] ?? c.status}
            </Badge>
            {c.tribunalCode ? (
              <Badge variant="outline" className="text-[10px]">
                {c.tribunalCode}
              </Badge>
            ) : null}
            {c.uf ? <Badge variant="outline" className="text-[10px]">{c.uf}</Badge> : null}
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{c.title}</h3>
          {c.summary ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>
          ) : null}
        </div>
        <Link
          href={`/cases/${c.id}`}
          aria-label={`Abrir caso ${c.title}`}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
        <Stat label="Fatos" value={c._count.facts} />
        <Stat label="Pedidos" value={c._count.requests} />
        <Stat label="Drafts" value={c._count.drafts} />
        <Stat
          label="Riscos"
          value={c._count.risks}
          highlight={c._count.risks > 0}
        />
      </dl>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide">{label}</dt>
      <dd className={highlight ? "inline-flex items-center gap-1 font-semibold text-amber-300" : "font-mono"}>
        {highlight ? <ShieldAlert className="size-3" /> : null}
        {value}
      </dd>
    </div>
  );
}
