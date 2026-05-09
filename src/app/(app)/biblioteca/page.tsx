import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BibliotecaRecentDocuments } from "@/components/biblioteca/biblioteca-recent-documents";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  const { workspaceId } = await getWorkspaceContext();

  const [foundations, documents, pieces, cases] = await Promise.all([
    prisma.libraryFoundation.findMany({
      where: { workspaceId, deletedAt: null, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        tags: true,
        optInRag: true,
        optInMemory: true,
        useAsModel: true,
        useAsStyle: true,
      },
    }),
    prisma.document.findMany({
      where: { workspaceId, deletedAt: null, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        originalName: true,
        status: true,
        updatedAt: true,
        processId: true,
        caseId: true,
        case: { select: { id: true, title: true } },
      },
    }),
    prisma.legalPiece.findMany({
      where: { workspaceId, deletedAt: null, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        kind: true,
        updatedAt: true,
      },
    }),
    prisma.case.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  return (
    <AppShell title="Biblioteca">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Biblioteca — acervo do escritório</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Aqui entra o que é <strong className="text-foreground">referência reutilizável</strong>{" "}
              (fundamentos salvos). <strong className="text-foreground">Insumos</strong> (petições,
              provas) vivem em Documentos; <strong className="text-foreground">Peças</strong>{" "}
              (produção) no editor. Use os atalhos abaixo para não misturar conceitos.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Biblioteca = acervo + fundamentos</Badge>
              <Badge variant="secondary">Documento = insumo do caso</Badge>
              <Badge variant="outline">Peça = produção jurídica</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/documentos">Insumos (documentos)</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/editor">Peças</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/pesquisa-juridica?scope=legislacao">Pesquisa jurídica</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/biblioteca/fundamentos/novo">Novo fundamento</Link>
            </Button>
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Insumos recentes (documentos)</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/documentos">Gerenciar em Documentos</Link>
            </Button>
          </div>
          <Card className="p-4">
            <BibliotecaRecentDocuments documents={documents} cases={cases} />
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Peças recentes (produção)</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/editor">Abrir lista de peças</Link>
            </Button>
          </div>
          <Card className="p-4">
            {pieces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma peça ainda. Gere minutas a partir de um caso na aba Estratégia &amp; Peças.
              </p>
            ) : (
              <ul className="space-y-2">
                {pieces.map((p) => (
                  <li key={p.id}>
                    <Link href={`/editor/${p.id}`} className="block rounded-lg border border-white/5 p-3 hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{p.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {p.kind}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Atualizada {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Fundamentos de acervo</h2>
            <Badge variant="secondary">{foundations.length}</Badge>
          </div>
          <Card className="p-4">
            {foundations.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title="Nenhum fundamento salvo ainda"
                description="Salve trechos e posições reutilizáveis. Por padrão, nada entra em busca ou memória sem opt-in explícito."
                action={{ label: "Criar fundamento", href: "/biblioteca/fundamentos/novo" }}
              />
            ) : (
              <ul className="divide-y divide-white/5">
                {foundations.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/biblioteca/fundamentos/${f.id}`}
                        className="font-medium hover:underline"
                      >
                        {f.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(f.tags ?? []).slice(0, 8).map((t: string) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        {f.optInRag ? (
                          <Badge className="text-[10px]" title="Pode ser citado em buscas assistidas quando aprovado">
                            Busca assistida
                          </Badge>
                        ) : null}
                        {f.optInMemory ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Memória
                          </Badge>
                        ) : null}
                        {f.useAsModel ? (
                          <Badge variant="outline" className="text-[10px]">
                            Modelo de peça
                          </Badge>
                        ) : null}
                        {f.useAsStyle ? (
                          <Badge variant="outline" className="text-[10px]">
                            Referência de estilo
                          </Badge>
                        ) : null}
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
        </section>
      </div>
    </AppShell>
  );
}
