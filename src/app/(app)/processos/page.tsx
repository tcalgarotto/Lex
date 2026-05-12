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

 const processes = await prisma.process.findMany({
 where: { workspaceId },
 orderBy: { updatedAt: "desc" },
 });

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
 <div className="grid gap-8 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Novo processo judicial</CardTitle>
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
 <Button type="submit">Criar processo</Button>
 </form>
 </CardContent>
 </Card>

 <div>
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
