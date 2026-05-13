import Link from "next/link";
import { notFound } from "next/navigation";
import { CourtConnectorType } from "@prisma/client";
import { SetPageTitle } from "@/components/app/set-page-title";
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
import { ProcessCalendarTab } from "@/components/calendar/process-calendar-tab";
import { GeneratePieceDialog } from "@/components/process/generate-piece-dialog";
import type { JSONValue } from "ai";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
 createLegalPieceAndRedirect,
 createMemoryEntryAction,
 addTimelineEventAction,
syncLegalProcessAction,
createOfficialCommunicationAction,
} from "@/app/(app)/processos/actions";
import { computeProcessHealth } from "@/lib/legal-processes/process-health";
import { buildProcessCopilotBrief } from "@/lib/legal-processes/process-copilot";
import { getCourtConnectorDefinitions } from "@/lib/court-connectors/registry";
import { buildCourtPublicQueryUrl, buildDataJudOfficialLink } from "@/lib/court-links";

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

 const legalProcess = await prisma.legalProcess.findFirst({
 where: { workspaceId, processId: proc.id },
 include: {
 movements: { orderBy: [{ dataHora: "desc" }, { createdAt: "desc" }], take: 20 },
 alerts: { orderBy: { createdAt: "desc" }, take: 10 },
 syncLogs: { orderBy: { startedAt: "desc" }, take: 5 },
 },
 });

 const officialCommunications = await prisma.officialCommunication.findMany({
 where: {
 workspaceId,
 OR: [
 { processId: proc.id },
 ...(legalProcess ? [{ legalProcessId: legalProcess.id }] : []),
 ],
 },
 orderBy: { createdAt: "desc" },
 take: 10,
 });

 const [dataJudHealth, copilotBrief] = legalProcess
 ? await Promise.all([
 computeProcessHealth({ workspaceId, legalProcessId: legalProcess.id }),
 buildProcessCopilotBrief({ workspaceId, legalProcessId: legalProcess.id }),
 ])
 : [null, null];

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
 const officialSourceProviderSet = new Set<CourtConnectorType>([
 CourtConnectorType.DATAJUD_PUBLIC,
 CourtConnectorType.TRIBUNAL_PUBLIC_QUERY,
 CourtConnectorType.ESCRITORIO_DIGITAL,
 CourtConnectorType.DOMICILIO_JUDICIAL,
 CourtConnectorType.DJEN,
 CourtConnectorType.MANUAL_UPLOAD,
 CourtConnectorType.MANUAL_PASTE,
 ]);
 const officialSourceCards = getCourtConnectorDefinitions().filter((connector) =>
 officialSourceProviderSet.has(connector.provider),
 );
 const courtLink = buildCourtPublicQueryUrl({
 cnj: proc.number,
 tribunalAcronym: legalProcess?.tribunalAcronym ?? proc.tribunal,
 system: legalProcess?.sistemaNome ?? null,
 });
 const dataJudLink = buildDataJudOfficialLink();

 return (
 <>
 <SetPageTitle title={proc.title ?? proc.number} />
 <Card className="mb-6 ">
 <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
 <div className="min-w-0">
 <p className="text-xs text-muted-foreground">
 {proc.tribunal} · {proc.vara}
 </p>
 <p className="mt-1 text-lg font-medium">{proc.number}</p>
 <p className="mt-1 text-sm text-muted-foreground">{statusLine}</p>
 <div className="mt-3 flex flex-wrap gap-1">
 {proc.tags.map((t) => (
 <Badge key={t} variant="outline" className="whitespace-nowrap text-caption">
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
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 text-sm text-[color:var(--text-primary)]">
 <p className="whitespace-pre-wrap leading-relaxed">{headerSummary}</p>
 </div>
 ) : (
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 text-sm text-muted-foreground">
 Envie um despacho, sentença ou petição para começar a construir a memória jurídica deste processo.
 </div>
 )}
 </div>
 <div className="space-y-2">
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">Sinais vivos</p>
 <div className="mt-2 space-y-1 text-sm text-[color:var(--text-primary)]">
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
 <p>
 <span className="text-muted-foreground">DataJud:</span>{" "}
 {legalProcess ? `${legalProcess.tribunalAcronym} · ${legalProcess.movements.length} movs.` : "Não importado"}
 </p>
 </div>
 </div>
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">Confiança contextual</p>
 <p className="mt-2 text-sm text-[color:var(--text-primary)]">
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
 <TabsTrigger value="agenda">Agenda</TabsTrigger>
 <TabsTrigger value="datajud">DataJud</TabsTrigger>
<TabsTrigger value="official-sources">Fontes oficiais</TabsTrigger>
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

 <TabsContent value="agenda" className="space-y-4">
 <ProcessCalendarTab
 workspaceId={workspaceId}
 processId={proc.id}
 legalProcessId={legalProcess?.id ?? null}
 />
 </TabsContent>

 <TabsContent value="datajud" className="space-y-4">
 {legalProcess ? (
 <>
 <Card>
 <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
 <div>
 <CardTitle className="text-base">Capa DataJud</CardTitle>
 <p className="mt-1 text-sm text-muted-foreground">
 {legalProcess.tribunalAcronym} · {legalProcess.branch} · {legalProcess.dataJudStatus}
 </p>
 </div>
 <form action={syncLegalProcessAction}>
 <input type="hidden" name="processId" value={proc.id} />
 <input type="hidden" name="legalProcessId" value={legalProcess.id} />
 <Button type="submit" variant="outline" size="sm">Sincronizar agora</Button>
 </form>
 </CardHeader>
 <CardContent className="grid gap-4 md:grid-cols-3">
 <div>
 <p className="text-xs uppercase text-muted-foreground">Classe</p>
 <p className="mt-1 text-sm">{legalProcess.classeNome ?? "Não informada"}</p>
 </div>
 <div>
 <p className="text-xs uppercase text-muted-foreground">Órgão julgador</p>
 <p className="mt-1 text-sm">{legalProcess.orgaoJulgadorNome ?? "Não informado"}</p>
 </div>
 <div>
 <p className="text-xs uppercase text-muted-foreground">Último sync</p>
 <p className="mt-1 text-sm">
 {legalProcess.lastDataJudSyncAt
 ? formatDistanceToNow(legalProcess.lastDataJudSyncAt, { addSuffix: true, locale: ptBR })
 : "Ainda não sincronizado"}
 </p>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4 md:grid-cols-3">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Saúde processual</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-3xl font-semibold">{dataJudHealth?.score ?? 0}</p>
 <p className="mt-1 text-sm text-muted-foreground">{dataJudHealth?.status ?? "pendente"}</p>
 <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
 {(dataJudHealth?.reasons ?? []).map((reason) => (
 <li key={reason}>{reason}</li>
 ))}
 </ul>
 </CardContent>
 </Card>
 <Card className="md:col-span-2">
 <CardHeader>
 <CardTitle className="text-base">Copiloto Processual</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <p className="text-muted-foreground">
 Resumo operacional baseado apenas na capa, movimentações e alertas persistidos.
 </p>
 <div className="space-y-2">
 {(copilotBrief?.recommendations ?? []).map((item) => (
 <div key={item} className="rounded-lg border border-[color:var(--border-default)] p-3">
 {item}
 </div>
 ))}
 </div>
 <p className="text-xs text-muted-foreground">
 Não substitui conferência humana de prazo, intimação oficial ou autos completos.
 </p>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Timeline DataJud</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {legalProcess.movements.length === 0 ? (
 <p className="text-sm text-muted-foreground">Sem movimentações importadas.</p>
 ) : (
 legalProcess.movements.map((movement) => (
 <div key={movement.id} className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-sm">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex flex-wrap items-center gap-2">
 <Badge variant="outline" className="whitespace-nowrap text-caption">{movement.category}</Badge>
 <p className="font-medium">{movement.nome}</p>
 </div>
 <p className="text-xs text-muted-foreground">
 {movement.dataHora ? formatDistanceToNow(movement.dataHora, { addSuffix: true, locale: ptBR }) : "Sem data"}
 </p>
 </div>
 </div>
 ))
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Alertas e sync</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <p className="text-xs font-medium uppercase text-muted-foreground">Alertas</p>
 {legalProcess.alerts.length === 0 ? <p className="text-sm text-muted-foreground">Sem alertas.</p> : null}
 {legalProcess.alerts.map((alert) => (
 <div key={alert.id} className="rounded-lg border border-[color:var(--border-default)] p-3 text-sm">
 <p className="font-medium">{alert.title}</p>
 <p className="text-xs text-muted-foreground">{alert.description}</p>
 </div>
 ))}
 </div>
 <div className="space-y-2">
 <p className="text-xs font-medium uppercase text-muted-foreground">Últimos syncs</p>
 {legalProcess.syncLogs.map((log) => (
 <div key={log.id} className="rounded-lg border border-[color:var(--border-default)] p-3 text-sm">
 <p className="font-medium">{log.status}</p>
 <p className="text-xs text-muted-foreground">
 {formatDistanceToNow(log.startedAt, { addSuffix: true, locale: ptBR })} · {log.source}
 </p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </>
 ) : (
 <Card>
 <CardContent className="p-6 text-sm text-muted-foreground">
 Este processo ainda não foi importado do DataJud. Use a tela de processos para importar pelo CNJ e habilitar capa, movimentações, saúde e alertas.
 </CardContent>
 </Card>
 )}
 </TabsContent>

<TabsContent value="official-sources" className="space-y-4">
<Card>
<CardHeader>
<CardTitle className="text-base">Consultar na fonte oficial</CardTitle>
<p className="text-sm text-muted-foreground">
Abra fontes oficiais e registre no Lex apenas o que você conferiu. O Lex não armazena senha, PIN, certificado ou sessão de tribunal.
</p>
</CardHeader>
<CardContent className="grid gap-3 md:grid-cols-2">
<div className="rounded-xl border border-[color:var(--border-default)] p-3 text-sm">
<p className="font-medium">{dataJudLink.label}</p>
<p className="mt-1 text-xs text-muted-foreground">{dataJudLink.instruction}</p>
<Button asChild size="sm" variant="outline" className="mt-3">
<Link href={dataJudLink.url} target="_blank" rel="noreferrer">Abrir DataJud</Link>
</Button>
</div>
<div className="rounded-xl border border-[color:var(--border-default)] p-3 text-sm">
<p className="font-medium">{courtLink.label}</p>
<p className="mt-1 text-xs text-muted-foreground">{courtLink.instruction}</p>
{courtLink.url ? (
<Button asChild size="sm" variant="outline" className="mt-3">
<Link href={courtLink.url} target="_blank" rel="noreferrer">Abrir fonte oficial</Link>
</Button>
) : null}
</div>
</CardContent>
</Card>

<div className="grid gap-3 md:grid-cols-2">
{officialSourceCards.map((connector) => (
<Card key={connector.provider}>
<CardHeader>
<div className="flex items-start justify-between gap-3">
<div>
<CardTitle className="text-base">{connector.shortName}</CardTitle>
<p className="mt-1 text-sm text-muted-foreground">{connector.description}</p>
</div>
<Badge variant="outline">{connector.status === "active" ? "Ativo" : connector.status === "manual_bridge" ? "Abertura assistida" : connector.status === "public_read_only" ? "Público" : "Oficial-only"}</Badge>
</div>
</CardHeader>
<CardContent className="space-y-3 text-sm text-muted-foreground">
<p>{connector.delivers[0]}</p>
<p className="text-xs">Limite: {connector.limitations[0]}</p>
{connector.primaryActionUrl ? (
<Button asChild size="sm" variant="outline">
<Link href={connector.primaryActionUrl} target="_blank" rel="noreferrer">{connector.primaryActionLabel}</Link>
</Button>
) : null}
</CardContent>
</Card>
))}
</div>

<Card>
<CardHeader>
<CardTitle className="text-base">Importar da fonte oficial</CardTitle>
<p className="text-sm text-muted-foreground">
Cole uma intimação, publicação ou movimentação obtida em fonte oficial. O registro ficará marcado para revisão humana e não calcula prazo final automaticamente.
</p>
</CardHeader>
<CardContent>
<form action={createOfficialCommunicationAction} className="grid gap-4 md:grid-cols-2">
<input type="hidden" name="processId" value={proc.id} />
{legalProcess ? <input type="hidden" name="legalProcessId" value={legalProcess.id} /> : null}
<div className="space-y-1">
<Label htmlFor="official-source">Fonte</Label>
<select id="official-source" name="source" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
<option value="ESCRITORIO_DIGITAL">Escritório Digital</option>
<option value="DOMICILIO_JUDICIAL">Domicílio Judicial</option>
<option value="DJEN">DJEN</option>
<option value="OFFICIAL_GAZETTE">Diário oficial</option>
<option value="TRIBUNAL_PUBLIC_QUERY">Tribunal</option>
<option value="MANUAL">Outra fonte oficial</option>
</select>
</div>
<div className="space-y-1">
<Label htmlFor="official-type">Tipo</Label>
<select id="official-type" name="communicationType" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
<option value="INTIMACAO">Intimação</option>
<option value="CITACAO">Citação</option>
<option value="OFICIO">Ofício</option>
<option value="AUDIENCIA">Audiência</option>
<option value="PUBLICACAO">Publicação</option>
<option value="OUTRO">Outro</option>
</select>
</div>
<div className="space-y-1">
<Label htmlFor="official-received">Recebido/publicado em</Label>
<Input id="official-received" name="receivedAt" type="date" />
</div>
<div className="space-y-1">
<Label htmlFor="official-review">Revisar até</Label>
<Input id="official-review" name="dueReviewAt" type="date" />
</div>
<div className="space-y-1 md:col-span-2">
<Label htmlFor="official-title">Título</Label>
<Input id="official-title" name="title" required placeholder="Ex.: Intimação recebida no Domicílio Judicial" />
</div>
<div className="space-y-1 md:col-span-2">
<Label htmlFor="official-description">Resumo</Label>
<Textarea id="official-description" name="description" rows={2} />
</div>
<div className="space-y-1 md:col-span-2">
<Label htmlFor="official-raw">Texto colado</Label>
<Textarea id="official-raw" name="rawText" rows={5} />
</div>
<div className="md:col-span-2">
<Button type="submit">Registrar e criar revisão</Button>
</div>
</form>
</CardContent>
</Card>

<Card>
<CardHeader>
<CardTitle className="text-base">Registros importados</CardTitle>
</CardHeader>
<CardContent className="space-y-3">
{officialCommunications.length === 0 ? (
<p className="text-sm text-muted-foreground">Nenhuma comunicação oficial registrada manualmente para este processo.</p>
) : null}
{officialCommunications.map((item) => (
<div key={item.id} className="rounded-xl border border-[color:var(--border-default)] p-3 text-sm">
<div className="flex flex-wrap items-center justify-between gap-2">
<p className="font-medium">{item.title}</p>
<Badge variant="outline">{item.status}</Badge>
</div>
<p className="mt-1 text-xs text-muted-foreground">
{item.source} · {item.communicationType} · revisão humana obrigatória
</p>
{item.description ? <p className="mt-2 text-muted-foreground">{item.description}</p> : null}
</div>
))}
</CardContent>
</Card>
</TabsContent>

 <TabsContent value="timeline" className="space-y-4">
 <Card>
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
 <div key={a.id} className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex flex-wrap items-center gap-2">
 <Badge variant="outline" className="whitespace-nowrap text-caption">
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
 origem: <span className="text-[color:var(--text-primary)]">Lex</span>
 </p>
 ) : null}
 </div>
 ))
 )}
 </CardContent>
 </Card>

 <Card>
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
 <Card>
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
 <div key={m.id} className="rounded-lg border border-[color:var(--border-default)] px-4 py-3 text-sm">
 <Badge variant="outline" className="mb-1 whitespace-nowrap text-caption">
 {m.kind}
 </Badge>
 {m.title ? <p className="font-medium">{m.title}</p> : null}
 <p className="text-muted-foreground">{m.content}</p>
 </div>
 ))}
 </div>
 </TabsContent>

 <TabsContent value="pecas" className="space-y-4">
 <Card>
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
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 text-sm text-muted-foreground">
 <p className="font-medium text-[color:var(--text-primary)]">Sem peças ainda</p>
 <p className="mt-1">
 Gere uma primeira manifestação com base nos documentos processuais. O Lex vai registrar fontes, confiança e alertas de revisão no editor.
 </p>
 </div>
 ) : null}
 {proc.pieces.map((p) => (
 <Link
 key={p.id}
 href={`/editor/${p.id}`}
 className="block rounded-lg border border-[color:var(--border-default)] px-4 py-3 hover:bg-[color:var(--surface-overlay)]"
 >
 <p className="font-medium">{p.title}</p>
 <p className="text-xs text-muted-foreground">{p.kind}</p>
 </Link>
 ))}
 </div>
 </TabsContent>
 </Tabs>
 </>
 );
}
