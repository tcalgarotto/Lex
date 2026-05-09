import { AppShell } from "@/components/app/app-shell";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessVirtualList } from "@/components/processes/process-virtual-list";
import { createProcessAndRedirect } from "@/app/(app)/processos/actions";
import { formatCnj } from "@/lib/cnj";

export default async function ProcessosPage() {
  const { workspaceId } = await getWorkspaceContext();
  const processes = await prisma.process.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell title="Processos judiciais">
      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Novo processo judicial</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProcessAndRedirect} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="number">Número CNJ</Label>
                <Input
                  id="number"
                  name="number"
                  required
                  placeholder="0000000-00.0000.0.00.0000"
                  inputMode="numeric"
                  onBlur={(e) => {
                    e.currentTarget.value = formatCnj(e.currentTarget.value);
                  }}
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
    </AppShell>
  );
}
