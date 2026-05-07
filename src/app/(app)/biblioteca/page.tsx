import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const highlightId = sp.id;

  const sources = await prisma.legalSource.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const selected = highlightId
    ? await prisma.legalSource.findUnique({ where: { id: highlightId } })
    : null;

  return (
    <AppShell title="Biblioteca jurídica">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Busca local</CardTitle>
            <form className="flex gap-2 pt-2" method="get">
              <Input name="q" defaultValue={q} placeholder="CPC, STJ, artigo…" className="flex-1" />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              <ul className="space-y-1 p-4 pt-0">
                {sources.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/biblioteca?id=${s.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm hover:bg-white/5 ${s.id === highlightId ? "bg-violet-500/10" : ""}`}
                    >
                      <span className="font-medium">{s.code}</span>{" "}
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {s.layer}
                      </Badge>
                      {s.articleRef ? (
                        <p className="text-xs text-muted-foreground">{s.articleRef}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Texto</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <ScrollArea className="h-[560px]">
                <article className="prose prose-invert max-w-none whitespace-pre-wrap pr-4 text-sm">
                  <h2>{selected.code}</h2>
                  {selected.articleRef ? <p className="text-muted-foreground">{selected.articleRef}</p> : null}
                  <p>{selected.body}</p>
                </article>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um item à esquerda ou abra a partir da busca global.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
