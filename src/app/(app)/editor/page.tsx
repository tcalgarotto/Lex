import Link from "next/link";
import { ScrollText, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Listagem de peças (LegalPiece) do workspace. As peças são geradas pelo
 * editor a partir de processos/casos. Clicar em uma abre `/editor/[id]`.
 */
export default async function PiecesIndexPage() {
  const { workspaceId } = await getWorkspaceContext();

  const pieces = await prisma.legalPiece.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      kind: true,
      updatedAt: true,
      processId: true,
      process: { select: { id: true, number: true } },
    },
  });

  return (
    <AppShell title="Peças">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Peças</h1>
          <p className="text-sm text-muted-foreground">
            Petições, contestações, memoriais e demais peças geradas pelo Lex. As minutas
            (versionadas) de um caso ficam dentro de Estratégia &amp; Peças do próprio caso.
          </p>
        </header>

        {pieces.length === 0 ? (
          <Card className="p-10 text-center">
            <ScrollText className="mx-auto mb-2 size-6 text-violet-300" />
            <p className="text-base font-medium">Nenhuma peça gerada ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie um caso, envie documentos e gere a estratégia para começar.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/cases">
                <Sparkles className="mr-1 size-3" /> Ir para Casos
              </Link>
            </Button>
          </Card>
        ) : (
          <ul className="space-y-2">
            {pieces.map((p) => (
              <li key={p.id}>
                <Link href={`/editor/${p.id}`} className="block">
                  <Card className="p-3 hover:bg-white/5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.title}</p>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {p.kind}
                          </Badge>
                          {p.process ? (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {p.process.number}
                            </Badge>
                          ) : null}
                          <span>
                            Atualizada {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
