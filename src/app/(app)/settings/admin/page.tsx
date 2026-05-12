import { AppShell } from "@/components/app/app-shell";
import { requireObservabilityViewPage } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminInternoPage() {
 const { workspaceId } = await requireObservabilityViewPage();

 const since = new Date();
 since.setDate(since.getDate() - 30);

 const [costs, costAgg, logs] = await Promise.all([
 prisma.costLedgerEntry.findMany({
 where: { workspaceId, createdAt: { gte: since } },
 orderBy: { createdAt: "desc" },
 take: 80,
 }),
 prisma.costLedgerEntry.groupBy({
 by: ["category"],
 where: { workspaceId, createdAt: { gte: since } },
 _sum: { costUsd: true, totalTokens: true },
 _count: true,
 }),
 prisma.observabilityLog.findMany({
 where: { workspaceId, createdAt: { gte: since } },
 orderBy: { createdAt: "desc" },
 take: 60,
 }),
 ]);

 return (
 <AppShell title="Admin — custos e observabilidade">
 <div className="space-y-6">
 <p className="text-sm text-muted-foreground">
 Visível apenas para OWNER do workspace. Dados dos últimos 30 dias (tenant = workspace).
 </p>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Resumo de custo (estimado)</CardTitle>
 </CardHeader>
 <CardContent>
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-[color:var(--border-default)] text-muted-foreground">
 <th className="pb-2 pr-4 font-medium">Categoria</th>
 <th className="pb-2 pr-4 font-medium">Eventos</th>
 <th className="pb-2 pr-4 font-medium">Tokens (soma)</th>
 <th className="pb-2 font-medium">USD (soma)</th>
 </tr>
 </thead>
 <tbody>
 {costAgg.map((row) => (
 <tr key={row.category} className="border-b border-[color:var(--border-subtle)]">
 <td className="py-2 pr-4">{row.category}</td>
 <td className="py-2 pr-4">{row._count}</td>
 <td className="py-2 pr-4">{row._sum.totalTokens ?? "—"}</td>
 <td className="py-2">
 {row._sum.costUsd != null ? row._sum.costUsd.toFixed(6) : "—"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Ledger recente</CardTitle>
 </CardHeader>
 <CardContent className="max-h-[420px] overflow-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-[color:var(--border-default)] text-muted-foreground">
 <th className="pb-2 pr-3 font-medium">Quando</th>
 <th className="pb-2 pr-3 font-medium">Categoria</th>
 <th className="pb-2 pr-3 font-medium">Provedor</th>
 <th className="pb-2 pr-3 font-medium">Modelo</th>
 <th className="pb-2 pr-3 font-medium">Tokens</th>
 <th className="pb-2 font-medium">USD</th>
 </tr>
 </thead>
 <tbody>
 {costs.map((c) => (
 <tr key={c.id} className="border-b border-[color:var(--border-subtle)]">
 <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
 {c.createdAt.toISOString().slice(0, 19)}
 </td>
 <td className="py-2 pr-3">{c.category}</td>
 <td className="py-2 pr-3">{c.provider}</td>
 <td className="max-w-[140px] truncate py-2 pr-3">{c.model ?? "—"}</td>
 <td className="py-2 pr-3">{c.totalTokens ?? "—"}</td>
 <td className="py-2">{c.costUsd != null ? c.costUsd.toFixed(6) : "—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Logs de observabilidade</CardTitle>
 </CardHeader>
 <CardContent className="max-h-[480px] overflow-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-[color:var(--border-default)] text-muted-foreground">
 <th className="pb-2 pr-3 font-medium">Quando</th>
 <th className="pb-2 pr-3 font-medium">Tipo</th>
 <th className="pb-2 pr-3 font-medium">Nome</th>
 <th className="pb-2 pr-3 font-medium">Latência ms</th>
 <th className="pb-2 font-medium">Erro</th>
 </tr>
 </thead>
 <tbody>
 {logs.map((l) => (
 <tr key={l.id} className="border-b border-[color:var(--border-subtle)]">
 <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
 {l.createdAt.toISOString().slice(0, 19)}
 </td>
 <td className="py-2 pr-3">{l.kind}</td>
 <td className="max-w-[120px] truncate py-2 pr-3">{l.name ?? "—"}</td>
 <td className="py-2 pr-3">{l.latencyMs}</td>
 <td className="max-w-[200px] truncate py-2 text-amber-200/90">
 {l.errorMessage ?? "—"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </CardContent>
 </Card>
 </div>
 </AppShell>
 );
}
