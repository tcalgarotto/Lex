import Link from "next/link";
import { Suspense } from "react";
import { DocumentStatus, JobRunStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Briefcase, FileText, HardDrive, Sparkles, AlertTriangle, Zap } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { TokenUsageChart } from "@/components/dashboard/token-usage-chart";
import { DocsByStatusChart } from "@/components/dashboard/docs-by-status-chart";
import { NextActionsCard } from "@/components/dashboard/next-actions-card";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildNextActions } from "@/lib/dashboard/next-actions";
import {
  deriveDocumentDisplayStatus,
  DOCUMENT_STATUS_LABELS_PT,
} from "@/lib/documents/status-display";

/** 
 * DASHBOARD ELITE — Refatorado para Streaming e Concorrência Máxima.
 * Cada seção carrega seus próprios dados de forma independente.
 */

async function StatsSection() {
  const { workspaceId } = await getWorkspaceContext();
  const [processCount, casesCount, docCount, indexedCount, storageAgg] = await Promise.all([
    prisma.process.count({ where: { workspaceId } }),
    prisma.case.count({ where: { workspaceId } }),
    prisma.document.count({ where: { workspaceId } }),
    prisma.document.count({ where: { workspaceId, status: DocumentStatus.INDEXED } }),
    prisma.document.aggregate({ where: { workspaceId }, _sum: { sizeBytes: true } }),
  ]);

  const storageBytes = storageAgg._sum.sizeBytes ?? 0;
  const bytesToHuman = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let n = bytes / 1024;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Casos"
        value={casesCount.toLocaleString("pt-BR")}
        hint={casesCount === 0 ? "Crie seu primeiro caso" : `${processCount} processo(s) legados`}
        icon={Briefcase}
      />
      <StatCard
        label="Documentos prontos"
        value={`${indexedCount.toLocaleString("pt-BR")} / ${docCount.toLocaleString("pt-BR")}`}
        hint={docCount === 0 ? "Envie documentos para começar" : `${Math.round((indexedCount / Math.max(docCount, 1)) * 100)}% prontos`}
        icon={FileText}
        tone="success"
      />
      <StatCard
        label="IA Ativa"
        value="Enterprise"
        hint="DeepSeek Mode ativado para pesquisa jurídica."
        icon={Sparkles}
      />
      <StatCard
        label="Armazenamento"
        value={bytesToHuman(storageBytes)}
        hint="volume total de arquivos"
        icon={HardDrive}
      />
    </div>
  );
}

async function NextActionsSection() {
  const { workspaceId } = await getWorkspaceContext();
  const nextActions = await buildNextActions(workspaceId);
  return <NextActionsCard bundle={nextActions} />;
}

async function QueueSection() {
  const { workspaceId } = await getWorkspaceContext();
  const queueDocs = await prisma.document.findMany({
    where: { workspaceId, status: { in: [DocumentStatus.PARSING, DocumentStatus.CHUNKING, DocumentStatus.EMBEDDING] } },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Em processamento</CardTitle>
        <CardDescription>Arquivos sendo preparados para leitura.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {queueDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum job em andamento.</p>
        ) : (
          queueDocs.map((d) => (
            <div key={d.id} className="rounded-lg border border-[color:var(--border-subtle)] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{d.originalName}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {deriveDocumentDisplayStatus({ status: d.status, updatedAt: d.updatedAt }).label}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

async function ChartsSection() {
  const { workspaceId } = await getWorkspaceContext();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  since.setUTCHours(0, 0, 0, 0);

  const [docStatusGroup, costRows] = await Promise.all([
    prisma.document.groupBy({ by: ["status"], where: { workspaceId }, _count: { _all: true } }),
    prisma.costLedgerEntry.findMany({ where: { workspaceId, createdAt: { gte: since } }, select: { createdAt: true, totalTokens: true, costUsd: true } }),
  ]);

  const docCount = docStatusGroup.reduce((acc, g) => acc + g._count._all, 0);
  
  // Prep token series
  const seriesMap = new Map();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const k = d.toISOString().split('T')[0]!;
    seriesMap.set(k, { date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), tokens: 0, costUsd: 0 });
  }
  for (const row of costRows) {
    const k = row.createdAt.toISOString().split('T')[0]!;
    const point = seriesMap.get(k);
    if (point) { point.tokens += row.totalTokens ?? 0; point.costUsd += row.costUsd ?? 0; }
  }
  const tokenSeries = Array.from(seriesMap.values());
  const totalTokens14d = tokenSeries.reduce((s, p) => s + p.tokens, 0);

  // Prep status data
  const statusCount = new Map(docStatusGroup.map(g => [g.status, g._count._all]));
  const docStatusData = [
    DocumentStatus.UPLOADED, DocumentStatus.PARSING, DocumentStatus.CHUNKING, 
    DocumentStatus.EMBEDDING, DocumentStatus.INDEXED, DocumentStatus.FAILED
  ].map(s => ({
    statusKey: s,
    label: DOCUMENT_STATUS_LABELS_PT[s],
    count: statusCount.get(s) ?? 0,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Ritmo de trabalho assistido</CardTitle>
          <CardDescription>Intensidade agregada por dia (14 dias).</CardDescription>
        </CardHeader>
        <CardContent>
          {totalTokens14d === 0 ? (
            <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] text-sm text-muted-foreground">
              <Zap className="mb-2 size-6 opacity-60" /> Faça uma busca jurídica para começar.
            </div>
          ) : <TokenUsageChart data={tokenSeries} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onde seus documentos estão</CardTitle>
          <CardDescription>Distribuição por fase.</CardDescription>
        </CardHeader>
        <CardContent>
          {docCount === 0 ? (
             <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] text-sm text-muted-foreground">
             <FileText className="mb-2 size-6 opacity-60" /> Sem documentos.
           </div>
          ) : <DocsByStatusChart data={docStatusData} />}
        </CardContent>
      </Card>
    </div>
  );
}

async function ActivitySection() {
  const { workspaceId } = await getWorkspaceContext();
  const activities = await prisma.activity.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle className="text-base">Atividade do workspace</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {activities.length === 0 ? <p className="text-sm text-muted-foreground">Sem atividade recente.</p> :
          activities.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 border-b border-[color:var(--border-subtle)] pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-[color:var(--text-primary)]">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">{a.kind}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          ))
        }
      </CardContent>
    </Card>
  );
}

async function AlertsSection() {
  const { workspaceId } = await getWorkspaceContext();
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const [failedCount, failedJobs] = await Promise.all([
    prisma.jobRun.count({ where: { workspaceId, status: JobRunStatus.FAILED, updatedAt: { gte: since } } }),
    prisma.jobRun.findMany({ where: { workspaceId, status: JobRunStatus.FAILED }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Alertas</CardTitle>
          <CardDescription>{failedCount} falhas em 14 dias</CardDescription>
        </div>
        <AlertTriangle className={`size-5 ${failedCount > 0 ? "text-amber-300" : "text-emerald-300"}`} />
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {failedJobs.length === 0 ? <p className="text-muted-foreground">Nenhuma falha recente.</p> :
          failedJobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
              <p className="truncate font-medium text-red-200">{j.name}</p>
              <p className="truncate text-[11px] text-red-300/80">{j.errorMessage ?? "—"}</p>
            </div>
          ))
        }
        <Button variant="outline" size="sm" className="w-full" asChild><Link href="/settings/jobs">Ver fila de jobs</Link></Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <AppShell title="Início">
      <div className="space-y-6">
        <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>}>
          <StatsSection />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
              <NextActionsSection />
            </Suspense>
          </div>
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <QueueSection />
          </Suspense>
        </div>

        <Suspense fallback={<div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-64 rounded-xl lg:col-span-2" /><Skeleton className="h-64 rounded-xl" /></div>}>
          <ChartsSection />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl lg:col-span-2" />}>
            <ActivitySection />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <AlertsSection />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}
