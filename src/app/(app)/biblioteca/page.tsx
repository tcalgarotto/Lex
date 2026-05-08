import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  legalNormProductionWhere,
  shouldBypassDemoVisibility,
} from "@/lib/corpus/source-visibility";

/**
 * Biblioteca jurídica oficial.
 *
 * Lista `LegalNorm` (canônico) com filtro anti-DEMO. Quando o usuário
 * seleciona uma norma, mostra os primeiros chunks. Sem dependência da tabela
 * `LegalSource` (legacy, removida no reset canônico).
 */
export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const highlightId = sp.id;
  const isProduction = process.env.NODE_ENV === "production";
  const bypassDemo = shouldBypassDemoVisibility({
    searchParams: { all: sp.all ?? null },
    pathname: "/biblioteca",
    isProduction,
  });

  const productionFilter = bypassDemo ? {} : legalNormProductionWhere();
  const queryFilter = q
    ? {
        OR: [
          { identifier: { contains: q, mode: "insensitive" as const } },
          { title: { contains: q, mode: "insensitive" as const } },
          { urn: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const norms = await prisma.legalNorm.findMany({
    where: { ...productionFilter, ...queryFilter },
    orderBy: [{ kind: "asc" }, { identifier: "asc" }],
    select: {
      id: true,
      urn: true,
      kind: true,
      identifier: true,
      title: true,
      jurisdiction: true,
      tribunal: true,
      sourceProvider: true,
    },
    take: 80,
  });

  const selectedNorm = highlightId
    ? await prisma.legalNorm.findUnique({
        where: { id: highlightId },
        select: {
          id: true,
          urn: true,
          identifier: true,
          title: true,
          kind: true,
          jurisdiction: true,
          tribunal: true,
          sourceUrl: true,
          sourceProvider: true,
        },
      })
    : null;

  const selectedChunks = selectedNorm
    ? await prisma.legalChunk.findMany({
        where: { normId: selectedNorm.id },
        orderBy: [{ ordinal: "asc" }],
        select: {
          id: true,
          articleRef: true,
          fullPath: true,
          text: true,
        },
        take: 60,
      })
    : [];

  return (
    <AppShell title="Biblioteca jurídica">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Busca local</CardTitle>
            <form className="flex gap-2 pt-2" method="get">
              <Input name="q" defaultValue={q} placeholder="CPC, Lei 8.078, art. 489…" className="flex-1" />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              <ul className="space-y-1 p-4 pt-0">
                {norms.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/biblioteca?id=${n.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm hover:bg-white/5 ${n.id === highlightId ? "bg-violet-500/10" : ""}`}
                    >
                      <span className="font-medium">{n.identifier ?? n.title}</span>{" "}
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {n.kind}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{n.title}</p>
                    </Link>
                  </li>
                ))}
                {norms.length === 0 ? (
                  <li className="px-3 py-6 text-xs text-muted-foreground">
                    Nenhuma norma encontrada.
                  </li>
                ) : null}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Texto</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNorm ? (
              <ScrollArea className="h-[560px]">
                <article className="prose prose-invert max-w-none whitespace-pre-wrap pr-4 text-sm">
                  <header className="not-prose mb-4">
                    <h2 className="text-lg font-semibold">
                      {selectedNorm.identifier ?? selectedNorm.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedNorm.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{selectedNorm.kind}</Badge>
                      {selectedNorm.jurisdiction ? (
                        <Badge variant="outline">{selectedNorm.jurisdiction}</Badge>
                      ) : null}
                      {selectedNorm.tribunal ? (
                        <Badge variant="outline">{selectedNorm.tribunal}</Badge>
                      ) : null}
                      <Badge variant="outline">{selectedNorm.sourceProvider}</Badge>
                      {selectedNorm.sourceUrl ? (
                        <a
                          href={selectedNorm.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-300 hover:underline"
                        >
                          Fonte oficial ↗
                        </a>
                      ) : null}
                    </div>
                  </header>
                  {selectedChunks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem trechos indexados para esta norma.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedChunks.map((c) => (
                        <section key={c.id} className="rounded-md border border-white/5 bg-zinc-900/40 p-3">
                          {c.fullPath || c.articleRef ? (
                            <p className="mb-1 text-xs uppercase text-muted-foreground">
                              {c.fullPath ?? c.articleRef}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap">{c.text}</p>
                        </section>
                      ))}
                    </div>
                  )}
                </article>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma norma à esquerda ou abra a partir da busca global.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
