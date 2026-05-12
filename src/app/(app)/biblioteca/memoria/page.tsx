import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officeMemoryReadableWhere } from "@/lib/office-memory/visibility";
import { OfficeMemoryPanel, type OfficeMemoryRow } from "@/components/biblioteca/office-memory-panel";

export const dynamic = "force-dynamic";

export default async function BibliotecaMemoriaPage() {
 const { workspaceId, user } = await getWorkspaceContext();

 const [memories, cases] = await Promise.all([
 prisma.officeMemory.findMany({
 where: {
 workspaceId,
 deletedAt: null,
 ...officeMemoryReadableWhere(user.id),
 },
 orderBy: { updatedAt: "desc" },
 take: 200,
 select: {
 id: true,
 scope: true,
 caseId: true,
 ownerUserId: true,
 title: true,
 private: true,
 useAsModel: true,
 useAsStyle: true,
 optInRag: true,
 originType: true,
 originId: true,
 archivedAt: true,
 createdAt: true,
 updatedAt: true,
 case: { select: { id: true, title: true } },
 },
 }),
 prisma.case.findMany({
 where: { workspaceId },
 orderBy: { updatedAt: "desc" },
 take: 100,
 select: { id: true, title: true },
 }),
 ]);

 const initialMemories: OfficeMemoryRow[] = memories.map((m) => ({
 ...m,
 archivedAt: m.archivedAt ? m.archivedAt.toISOString() : null,
 createdAt: m.createdAt.toISOString(),
 updatedAt: m.updatedAt.toISOString(),
 }));

 return (
 <AppShell title="Memória do workspace">
 <div className="mx-auto max-w-4xl space-y-6">
 <header className="flex flex-wrap items-start justify-between gap-3">
 <div className="space-y-2">
 <h1 className="text-2xl font-semibold">Memória do workspace</h1>
 <p className="max-w-2xl text-sm text-muted-foreground">
 Textos guardados por âmbito (toda a equipa, só você ou ligados a um caso). Tudo é{" "}
 <strong className="text-foreground">opt-in</strong>: nada é gravado automaticamente. Ative as flags só
 quando fizer sentido para modelo, estilo ou pesquisa interna.
 </p>
 </div>
 <Button asChild variant="outline" size="sm">
 <Link href="/biblioteca">Voltar à biblioteca</Link>
 </Button>
 </header>
 <OfficeMemoryPanel initialMemories={initialMemories} cases={cases} />
 </div>
 </AppShell>
 );
}
