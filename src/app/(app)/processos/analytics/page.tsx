import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getProcessAnalytics } from "@/lib/legal-processes/process-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProcessAnalyticsPage() {
  const { workspaceId } = await getWorkspaceContext();
  const analytics = await getProcessAnalytics(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Painel processual</h1>
          <p className="text-sm text-muted-foreground">
            Visão operacional dos processos DataJud persistidos no workspace.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/processos">Voltar aos processos</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="mt-1 text-2xl font-semibold">{analytics.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Alertas abertos</p><p className="mt-1 text-2xl font-semibold">{analytics.openAlerts}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Movs. 7 dias</p><p className="mt-1 text-2xl font-semibold">{analytics.recentMovements}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Erros sync</p><p className="mt-1 text-2xl font-semibold">{analytics.syncErrors}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Por tribunal</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.byTribunal.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : null}
            {analytics.byTribunal.map((row) => (
              <div key={row.tribunal} className="flex items-center justify-between rounded-lg border border-[color:var(--border-default)] p-3 text-sm">
                <span>{row.tribunal}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por status DataJud</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.byStatus.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : null}
            {analytics.byStatus.map((row) => (
              <div key={row.status} className="flex items-center justify-between rounded-lg border border-[color:var(--border-default)] p-3 text-sm">
                <span>{row.status}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
