import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  const { workspaceId } = await getWorkspaceContext();
  const foundations = await prisma.libraryFoundation.findMany({
    where: { workspaceId, deletedAt: null, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      tags: true,
      optInRag: true,
      optInMemory: true,
    },
  });

  return (
    <AppShell title="Biblioteca">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Biblioteca</h1>
            <p className="text-sm text-muted-foreground">
              Guarde fundamentos, modelos e referências do escritório — com controle de uso em IA (opt-in).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/pesquisa-juridica?scope=legislacao">Pesquisar legislação</Link>
            </Button>
            <Button asChild>
              <Link href="/biblioteca/fundamentos/novo">Novo fundamento</Link>
            </Button>
          </div>
        </header>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Fundamentos salvos</h2>
            <Badge variant="secondary">{foundations.length}</Badge>
          </div>
          {foundations.length === 0 ? (
            <div className="pt-4">
              <EmptyState
                title="Nenhum fundamento salvo ainda"
                description="Salve um fundamento reutilizável do escritório. Por padrão, nada entra em RAG/memória sem opt-in."
                action={{ label: "Criar fundamento", href: "/biblioteca/fundamentos/novo" }}
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-white/5">
              {foundations.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/biblioteca/fundamentos/${f.id}`} className="font-medium hover:underline">
                      {f.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(f.tags ?? []).slice(0, 6).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      {f.optInRag ? <Badge className="text-[10px]">RAG</Badge> : null}
                      {f.optInMemory ? <Badge variant="secondary" className="text-[10px]">Memória</Badge> : null}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/biblioteca/fundamentos/${f.id}`}>Abrir</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
