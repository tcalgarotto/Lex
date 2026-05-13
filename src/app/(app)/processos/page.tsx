import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessVirtualList } from "@/components/processes/process-virtual-list";
import { createProcessAndRedirect } from "@/app/(app)/processos/actions";
import { CnjInput } from "@/components/processes/cnj-input";
import { DataJudImportCard } from "@/components/processes/datajud-import-card";
import { getProcessAnalytics } from "@/lib/legal-processes/process-analytics";

export default async function ProcessosPage({
 searchParams,
}: {
 searchParams?: Promise<{ returnCase?: string }>;
}) {
 const { workspaceId } = await getWorkspaceContext();
 const sp = (await searchParams) ?? {};
 const returnCaseId =
 typeof sp.returnCase === "string" && sp.returnCase.trim().length > 0
 ? sp.returnCase.trim()
 : null;

 const [processes, analytics, latestLegalProcesses] = await Promise.all([
 prisma.process.findMany({
 where: { workspaceId },
 orderBy: { updatedAt: "desc" },
 }),
 getProcessAnalytics(workspaceId),
 prisma.legalProcess.findMany({
 where: { workspaceId },
 orderBy: { updatedAt: "desc" },
 take: 6,
 select: {
 id: true,
 processId: true,
 cnjFormatted: true,
 tribunalAcronym: true,
 classeNome: true,
 orgaoJulgadorNome: true,
 lastDataJudSyncAt: true,
 dataJudStatus: true,
 _count: { select: { movements: true, alerts: true } },
 },
 }),
 ]);

 return (
 <>
 {returnCaseId ? (
 <div className="mb-6 rounded-lg border border-violet-500/25 bg-violet-500/5 px-4 py-3 text-sm text-violet-100">
 <p className="mb-2">
 Você veio de um caso em fase pré-processual. Depois de criar ou localizar o
 processo, volte ao caso para concluir o vínculo.
 </p>
 <Button asChild variant="secondary" size="sm">
 <Link href={`/cases/${returnCaseId}`}>Voltar ao caso</Link>
 </Button>
 </div>
 ) : null}
 <div className="mb-6 grid gap-3 md:grid-cols-4">
 <Card>
 <CardContent className="p-4">
 <p className="text-xs uppercase text-muted-foreground">Processos DataJud</p>
 <p className="mt-1 text-2xl font-semibold">{analytics.total}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <p className="text-xs uppercase text-muted-foreground">Alertas abertos</p>
 <p className="mt-1 text-2xl font-semibold">{analytics.openAlerts}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <p className="text-xs uppercase text-muted-foreground">Movs. 7 dias</p>
 <p className="mt-1 text-2xl font-semibold">{analytics.recentMovements}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <p className="text-xs uppercase text-muted-foreground">Falhas sync</p>
 <p className="mt-1 text-2xl font-semibold">{analytics.syncErrors}</p>
 </CardContent>
 </Card>
 </div>

 <div className="grid gap-8 lg:grid-cols-2">
 <DataJudImportCard returnCaseId={returnCaseId} />

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Cadastro manual</CardTitle>
 </CardHeader>
 <CardContent>
 <form action={createProcessAndRedirect} className="space-y-3">
 <div className="space-y-1">
 <Label htmlFor="number">Número CNJ</Label>
 <CnjInput
 id="number"
 name="number"
 required
 placeholder="0000000-00.0000.0.00.0000"
 inputMode="numeric"
 />
 </div>
 <div className="space-y-1">
 <Label htmlFor="title">Título</Label>
 <Input id="title" name="title" placeholder="Opcional" />
 </div>
 <div className="grid gap-3 sm:grid-cols-2">
 <div className="space-y-1">
 <Label htmlFor="vara">Vara</Label>
 <Input id="vara" name="vara" />
 </div>
 <div className="space-y-1">
 <Label htmlFor="tribunal">Tribunal</Label>
 <Input id="tribunal" name="tribunal" />
 </div>
 </div>
 <div className="space-y-1">
 <Label htmlFor="observations">Observações</Label>
 <Textarea id="observations" name="observations" rows={3} />
 </div>
 <div className="space-y-1">
 <Label htmlFor="tags">Tags (vírgula)</Label>
 <Input id="tags" name="tags" placeholder="cível, consumidor" />
 </div>
 <Button type="submit" variant="outline">Criar processo manual</Button>
 </form>
 </CardContent>
 </Card>

 <div className="lg:col-span-2">
 <div className="mb-6">
 <h2 className="mb-3 text-sm font-medium text-muted-foreground">Últimos processos DataJud</h2>
 {latestLegalProcesses.length === 0 ? (
 <p className="text-sm text-muted-foreground">Nenhum processo importado do DataJud ainda.</p>
 ) : (
 <div className="grid gap-3 md:grid-cols-2">
 {latestLegalProcesses.map((p) => (
 <Link
 key={p.id}
 href={`/processos/${p.processId ?? p.id}`}
 className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 hover:border-violet-400/40"
 >
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <p className="font-medium">{p.cnjFormatted}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 {p.tribunalAcronym} · {p.classeNome ?? "Classe não informada"}
 </p>
 </div>
 <span className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
 {p.dataJudStatus}
 </span>
 </div>
 <p className="mt-2 text-xs text-muted-foreground">
 {p.orgaoJulgadorNome ?? "Órgão julgador não informado"} · {p._count.movements} movimento(s) · {p._count.alerts} alerta(s)
 </p>
 </Link>
 ))}
 </div>
 )}
 </div>
 <h2 className="mb-3 text-sm font-medium text-muted-foreground">Todos os processos</h2>
 {processes.length === 0 ? (
 <p className="text-sm text-muted-foreground">Lista vazia.</p>
 ) : (
 <ProcessVirtualList items={processes} />
 )}
 </div>
 </div>
 </>
 );
}
