import { AppShell } from "@/components/app/app-shell";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { triggerCorpusReindexAction } from "@/app/(app)/processos/actions";

export default async function JobsPage() {
  const { workspaceId } = await requirePermission("observabilityView");
  const jobs = await prisma.jobRun.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  return (
    <AppShell title="Jobs IA">
      <div className="mb-6 flex flex-wrap gap-3">
        <form action={triggerCorpusReindexAction}>
          <Button type="submit" variant="secondary">
            Reindexar corpus (Inngest)
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Rode <code className="rounded bg-white/10 px-1">npx inngest-cli dev</code> localmente para processar filas.
        </p>
      </div>
      <Card className="border-white/10 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {jobs.length === 0 ? (
            <p className="text-muted-foreground">Sem registros ainda.</p>
          ) : (
            jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2">
                <div>
                  <p className="font-medium">{j.name}</p>
                  {j.errorMessage ? (
                    <p className="text-xs text-red-400">{j.errorMessage}</p>
                  ) : null}
                </div>
                <Badge variant="outline">{j.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
