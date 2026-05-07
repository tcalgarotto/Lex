import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProcessChat } from "@/components/chat/process-chat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProcessDocuments } from "@/components/process/process-documents";
import { GeneratePieceDialog } from "@/components/process/generate-piece-dialog";
import type { JSONValue } from "ai";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  createLegalPieceAndRedirect,
  createMemoryEntryAction,
  addTimelineEventAction,
} from "@/app/(app)/processos/actions";

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ processId: string }>;
}) {
  const { processId } = await params;
  const { workspaceId } = await getWorkspaceContext();

  const proc = await prisma.process.findFirst({
    where: { id: processId, workspaceId },
    include: {
      client: true,
      threads: true,
      documents: { orderBy: { updatedAt: "desc" } },
      timeline: { orderBy: { occurredAt: "desc" } },
      memories: { orderBy: { updatedAt: "desc" } },
      pieces: { orderBy: { updatedAt: "desc" } },
    },
  });

  if (!proc) notFound();

  const thread = proc.threads[0];
  if (!thread) notFound();

  const initialMessages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 120,
    select: { id: true, role: true, content: true, citationsJson: true, createdAt: true },
  });

  const [docIndexedCount, lastAi, lastUpload, lastPiece, latestProcessMemory] = await Promise.all([
    prisma.document.count({ where: { workspaceId, processId: proc.id, status: "INDEXED" } }),
    prisma.activity.findFirst({
      where: { workspaceId, metaJson: { path: ["processId"], equals: proc.id }, kind: { in: ["chat.message", "piece.generated"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activity.findFirst({
      where: { workspaceId, metaJson: { path: ["processId"], equals: proc.id }, kind: "document.uploaded" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activity.findFirst({
      where: { workspaceId, metaJson: { path: ["processId"], equals: proc.id }, kind: "piece.generated" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.memoryEntry.findFirst({
      where: { workspaceId, processId: proc.id, kind: "PROCESS" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const timeline = await prisma.activity.findMany({
    where: { workspaceId, metaJson: { path: ["processId"], equals: proc.id } },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  const memoryConfidence =
    docIndexedCount >= 3 && latestProcessMemory ? "Alta" : docIndexedCount >= 1 ? "Média" : "Baixa";
  const headerSummary =
    latestProcessMemory?.content?.slice(0, 2200) ??
    (proc.observations ? proc.observations.slice(0, 500) : null);
  const statusLine = [
    proc.title ? proc.title : null,
    docIndexedCount ? `${docIndexedCount} documento(s) indexado(s)` : "Sem documentos indexados",
    `Confiança contextual: ${memoryConfidence}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell title={proc.title ?? proc.number}>
      <Card className="mb-6 border-white/10 bg-zinc-900/40">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {proc.tribunal} · {proc.vara}
            </p>
            <p className="mt-1 text-lg font-medium">{proc.number}</p>
            <p className="mt-1 text-sm text-muted-foreground">{statusLine}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {proc.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/demo">Modo demonstração</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/processos">Voltar</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Resumo do caso (memória processual)
            </p>
            {headerSummary ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-200">
                <p className="whitespace-pre-wrap leading-relaxed">{headerSummary}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-muted-foreground">
                Envie um despacho, sentença ou petição para começar a construir a memória jurídica deste processo.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Sinais vivos</p>
              <div className="mt-2 space-y-1 text-sm text-zinc-200">
                <p>
                  <span className="text-muted-foreground">Docs indexados:</span> {docIndexedCount}
                </p>
                <p>
                  <span className="text-muted-foreground">Última interação IA:</span>{" "}
                  {lastAi ? formatDistanceToNow(lastAi.createdAt, { addSuffix: true, locale: ptBR }) : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Último upload:</span>{" "}
                  {lastUpload ? formatDistanceToNow(lastUpload.createdAt, { addSuffix: true, locale: ptBR }) : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Última peça gerada:</span>{" "}
                  {lastPiece ? formatDistanceToNow(lastPiece.createdAt, { addSuffix: true, locale: ptBR }) : "—"}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Confiança contextual</p>
              <p className="mt-2 text-sm text-zinc-200">
                {memoryConfidence}{" "}
                <span className="text-xs text-muted-foreground">
                  — baseada em documentos indexados e memória do processo.
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat">Chat IA</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="memory">Memória</TabsTrigger>
          <TabsTrigger value="pecas">Peças</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ProcessChat
            threadId={thread.id}
            initialMessages={initialMessages.map((m) => ({
              id: m.id,
              role: m.role === "USER" ? "user" : m.role === "ASSISTANT" ? "assistant" : "system",
              content: m.content,
              createdAt: m.createdAt,
              annotations: m.citationsJson
                ? [
                    {
                      type: "citations",
                      citations: JSON.parse(JSON.stringify(m.citationsJson)) as JSONValue,
                    } as unknown as JSONValue,
                  ]
                : [],
            }))}
          />
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <ProcessDocuments processId={proc.id} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card className="border-white/10 bg-zinc-900/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">História viva do processo</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/jobs">Ver jobs</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {timeline.length === 0 ? (
                <p className="text-muted-foreground">
                  Sem eventos ainda. Envie um documento ou faça uma pergunta no chat para iniciar a linha do tempo.
                </p>
              ) : (
                timeline.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-zinc-950/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {a.kind}
                        </Badge>
                        <p className="font-medium">{a.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {a.metaJson ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        origem: <span className="text-zinc-200">Lex</span>
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="text-base">Adicionar evento manual</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addTimelineEventAction} className="space-y-2">
                <input type="hidden" name="processId" value={proc.id} />
                <div className="space-y-1">
                  <Label htmlFor="ev-title">Título</Label>
                  <Input id="ev-title" name="title" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-desc">Descrição</Label>
                  <Textarea id="ev-desc" name="description" rows={2} />
                </div>
                <Button type="submit">Adicionar</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card className="border-white/10 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="text-base">Nova memória</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createMemoryEntryAction} className="space-y-2">
                <input type="hidden" name="processId" value={proc.id} />
                <div className="space-y-1">
                  <Label htmlFor="mem-kind">Tipo</Label>
                  <Input id="mem-kind" name="kind" placeholder="STRATEGY, THESIS, …" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mem-title">Título</Label>
                  <Input id="mem-title" name="title" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mem-content">Conteúdo</Label>
                  <Textarea id="mem-content" name="content" required rows={4} />
                </div>
                <Button type="submit">Salvar memória</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {proc.memories.map((m) => (
              <div key={m.id} className="rounded-lg border border-white/10 px-4 py-3 text-sm">
                <Badge variant="outline" className="mb-1 text-[10px]">
                  {m.kind}
                </Badge>
                {m.title ? <p className="font-medium">{m.title}</p> : null}
                <p className="text-muted-foreground">{m.content}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pecas" className="space-y-4">
          <Card className="border-white/10 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="text-base">Nova peça</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <GeneratePieceDialog processId={proc.id} />
              </div>
              <form action={createLegalPieceAndRedirect} className="space-y-2">
                <input type="hidden" name="processId" value={proc.id} />
                <div className="space-y-1">
                  <Label htmlFor="piece-kind">Tipo</Label>
                  <Input id="piece-kind" name="kind" placeholder="inicial, contestação…" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="piece-title">Título</Label>
                  <Input id="piece-title" name="title" required />
                </div>
                <Button type="submit">Abrir no editor</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {proc.pieces.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-zinc-200">Sem peças ainda</p>
                <p className="mt-1">
                  Gere uma primeira manifestação com base nos documentos processuais. O Lex vai registrar fontes, confiança e alertas de revisão no editor.
                </p>
              </div>
            ) : null}
            {proc.pieces.map((p) => (
              <Link
                key={p.id}
                href={`/editor/${p.id}`}
                className="block rounded-lg border border-white/10 px-4 py-3 hover:bg-white/5"
              >
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.kind}</p>
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
