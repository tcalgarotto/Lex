import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default async function DocumentoPage({
  params,
}: {
  params: Promise<{ processId: string; documentId: string }>;
}) {
  const { processId, documentId } = await params;
  const { workspaceId } = await getWorkspaceContext();

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId, processId },
    include: {
      chunks: { orderBy: { chunkIndex: "asc" }, take: 200 },
      process: true,
    },
  });
  if (!doc) notFound();

  const canUse = doc.status === "INDEXED";
  const pct = Math.round(Math.max(0, Math.min(1, doc.progress ?? 0)) * 100);

  return (
    <AppShell title={doc.originalName}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <Link href={`/processos/${processId}`} className="text-violet-400 hover:underline">
            Processo {doc.process?.number ?? ""}
          </Link>{" "}
          · status:{" "}
          <Badge variant="outline" className="text-[10px]">
            {doc.status} {doc.status !== "INDEXED" ? `(${pct}%)` : null}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/processos/${processId}`}>Voltar</Link>
          </Button>
          <Button asChild variant="secondary" size="sm" disabled={!canUse}>
            <Link
              href={`/processos/${processId}?chat=1&q=${encodeURIComponent(
                `Pergunta sobre o documento ${doc.originalName}: `,
              )}`}
            >
              Perguntar no chat
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Texto extraído</CardTitle>
          </CardHeader>
          <CardContent>
            {doc.extractedText ? (
              <ScrollArea className="h-[520px] rounded-lg border border-white/10 bg-zinc-950/40 p-3">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">
                  {doc.extractedText}
                </pre>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não há texto extraído. Aguarde o processamento (status: {doc.status}).
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">Chunks (até 200)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-3 text-xs text-muted-foreground">
              <p>
                {doc.totalChunks != null ? (
                  <>
                    total: <span className="text-zinc-200">{doc.totalChunks}</span> · processados:{" "}
                    <span className="text-zinc-200">{doc.processedChunks ?? 0}</span>
                  </>
                ) : (
                  <>total: —</>
                )}
              </p>
              <p className="mt-1">
                indexedAt:{" "}
                <span className="text-zinc-200">
                  {doc.indexedAt ? doc.indexedAt.toISOString().slice(0, 19) : "—"}
                </span>
              </p>
              <p className="mt-1">
                extractedAt:{" "}
                <span className="text-zinc-200">
                  {doc.extractedAt ? doc.extractedAt.toISOString().slice(0, 19) : "—"}
                </span>
              </p>
              {doc.errorMessage ? (
                <p className="mt-2 text-red-300">Erro: {doc.errorMessage}</p>
              ) : null}
            </div>

            <ScrollArea className="h-[520px] rounded-lg border border-white/10 bg-zinc-950/40 p-3">
              <div className="space-y-2">
                {doc.chunks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem chunks ainda.</p>
                ) : (
                  doc.chunks.map((c) => (
                    <div key={c.id} className="rounded-lg border border-white/10 bg-zinc-950/20 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          #{c.chunkIndex}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.section}
                        </Badge>
                        {c.tokenEstimate ? (
                          <span>~{c.tokenEstimate} tok</span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-200">
                        {c.textPreview}
                      </p>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        <p className="truncate">
                          hash: <span className="text-zinc-200">{c.contentHash ?? "—"}</span>
                        </p>
                        <p className="truncate">
                          qdrant: <span className="text-zinc-200">{c.qdrantPointId ?? "—"}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

