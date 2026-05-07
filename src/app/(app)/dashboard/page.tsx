import Link from "next/link";
import { Suspense } from "react";
import { DocumentStatus, JobRunStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, FolderKanban, HardDrive, Sparkles, AlertTriangle, Zap } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { TokenUsageChart, type TokenSeriesPoint } from "@/components/dashboard/token-usage-chart";
import { DocsByStatusChart, type DocStatusPoint } from "@/components/dashboard/docs-by-status-chart";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const DOC_STATUS_ORDER: DocumentStatus[] = [
  DocumentStatus.UPLOADED,
  DocumentStatus.PARSING,
  DocumentStatus.CHUNKING,
  DocumentStatus.EMBEDDING,
  DocumentStatus.INDEXED,
  DocumentStatus.FAILED,
];

function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
}

function dateKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

async function DashboardContent() {
  const { workspaceId } = await getWorkspaceContext();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  since.setUTCHours(0, 0, 0, 0);

  const [
    processCount,
    docCount,
    indexedCount,
    failedJobsCount,
    storageAgg,
    docStatusGroup,
    costRows,
    processes,
    queueDocs,
    activities,
    failedJobs,
  ] = await Promise.all([
    prisma.process.count({ where: { workspaceId } }),
    prisma.document.count({ where: { workspaceId } }),
    prisma.document.count({ where: { workspaceId, status: DocumentStatus.INDEXED } }),
    prisma.jobRun.count({
      where: { workspaceId, status: JobRunStatus.FAILED, updatedAt: { gte: since } },
    }),
    prisma.document.aggregate({
      where: { workspaceId },
      _sum: { sizeBytes: true },
    }),
    prisma.document.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    prisma.costLedgerEntry.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { createdAt: true, totalTokens: true, costUsd: true },
    }),
    prisma.process.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.document.findMany({
      where: {
        workspaceId,
        status: { in: [DocumentStatus.PARSING, DocumentStatus.CHUNKING, DocumentStatus.EMBEDDING] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.activity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.jobRun.findMany({
      where: { workspaceId, status: JobRunStatus.FAILED },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  // Series por dia (últimos 14)
  const seriesMap = new Map<string, TokenSeriesPoint>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const k = dateKey(d);
    seriesMap.set(k, { date: shortDate(k), tokens: 0, costUsd: 0 });
  }
  for (const row of costRows) {
    const k = dateKey(row.createdAt);
    const point = seriesMap.get(k);
    if (point) {
      point.tokens += row.totalTokens ?? 0;
      point.costUsd += row.costUsd ?? 0;
    }
  }
  const tokenSeries = Array.from(seriesMap.values());
  const totalTokens14d = tokenSeries.reduce((s, p) => s + p.tokens, 0);
  const totalCost14d = tokenSeries.reduce((s, p) => s + p.costUsd, 0);

  // Doc status (sempre na ordem do pipeline, mesmo zerados)
  const statusCount = new Map<string, number>();
  for (const g of docStatusGroup) statusCount.set(g.status, g._count._all);
  const docStatusData: DocStatusPoint[] = DOC_STATUS_ORDER.map((s) => ({
    status: s,
    count: statusCount.get(s) ?? 0,
  }));

  const storageBytes = storageAgg._sum.sizeBytes ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Processos"
          value={processCount.toLocaleString("pt-BR")}
          hint={processCount === 0 ? "Crie o primeiro processo" : "no workspace"}
          icon={FolderKanban}
        />
        <StatCard
          label="Docs indexados"
          value={`${indexedCount.toLocaleString("pt-BR")} / ${docCount.toLocaleString("pt-BR")}`}
          hint={
            docCount === 0
              ? "Faça upload de documentos"
              : `${Math.round((indexedCount / Math.max(docCount, 1)) * 100)}% pronto para RAG`
          }
          icon={FileText}
          tone="success"
        />
        <StatCard
          label="Tokens (14d)"
          value={totalTokens14d.toLocaleString("pt-BR")}
          hint={`USD ${totalCost14d.toFixed(4)} estimado`}
          icon={Sparkles}
        />
        <StatCard
          label="Armazenamento"
          value={bytesToHuman(storageBytes)}
          hint="documentos enviados"
          icon={HardDrive}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-white/10 bg-zinc-900/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Uso de IA — últimos 14 dias</CardTitle>
            <CardDescription>
              Tokens consumidos por dia. Custo estimado por provedor/modelo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalTokens14d === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-950/40 text-sm text-muted-foreground">
                <Zap className="mb-2 size-6 opacity-60" />
                Nenhum uso registrado ainda. Faça uma busca jurídica para começar.
              </div>
            ) : (
              <TokenUsageChart data={tokenSeries} />
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Pipeline de documentos</CardTitle>
            <CardDescription>Distribuição por estágio.</CardDescription>
          </CardHeader>
          <CardContent>
            {docCount === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-950/40 text-sm text-muted-foreground">
                <FileText className="mb-2 size-6 opacity-60" />
                Sem documentos.
              </div>
            ) : (
              <DocsByStatusChart data={docStatusData} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-white/10 bg-zinc-900/40 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Processos recentes</CardTitle>
              <CardDescription>Ordenados por última atualização.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/processos">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {processes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-950/40 px-6 py-10 text-center">
                <FolderKanban className="mb-2 size-6 text-violet-300" />
                <p className="text-sm text-zinc-300">Nenhum processo ainda.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Comece criando um processo ou rodando a demo.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" asChild>
                    <Link href="/processos">Novo processo</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/demo">Modo demonstração</Link>
                  </Button>
                </div>
              </div>
            ) : (
              processes.map((p) => (
                <Link
                  key={p.id}
                  href={`/processos/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title ?? p.number}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.number}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {formatDistanceToNow(p.updatedAt, { addSuffix: true, locale: ptBR })}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Em processamento</CardTitle>
            <CardDescription>
              Documentos sendo parseados, chunkados ou indexados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queueDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum job em andamento.</p>
            ) : (
              queueDocs.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-white/5 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{d.originalName}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {d.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(d.updatedAt, { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-white/10 bg-zinc-900/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Atividade do workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem atividade recente.</p>
            ) : (
              activities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.kind}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Alertas</CardTitle>
              <CardDescription>{failedJobsCount} falhas em 14 dias</CardDescription>
            </div>
            <AlertTriangle
              className={`size-5 ${failedJobsCount > 0 ? "text-amber-300" : "text-emerald-300"}`}
            />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {failedJobs.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma falha recente.</p>
            ) : (
              failedJobs.map((j) => (
                <div key={j.id} className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                  <p className="truncate font-medium text-red-200">{j.name}</p>
                  <p className="truncate text-[11px] text-red-300/80">
                    {j.errorMessage ?? "—"}
                  </p>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/settings/jobs">Ver fila de jobs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell title="Início">
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}
