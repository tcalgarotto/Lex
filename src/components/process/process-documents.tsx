"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, RefreshCw, Eye, MessageSquare, Loader2 } from "lucide-react";
import { DocumentStatus } from "@prisma/client";
import { DocumentDropzone } from "@/components/upload/document-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type DocRow = {
 id: string;
 originalName: string;
 mimeType: string;
 sizeBytes: number;
 status: DocumentStatus;
 errorMessage: string | null;
 progress: number;
 totalChunks: number | null;
 processedChunks: number | null;
 indexedAt: string | null;
 extractedAt: string | null;
 createdAt: string;
 updatedAt: string;
};

function statusTone(s: DocumentStatus): "secondary" | "outline" {
 if (s === "INDEXED") return "secondary";
 return "outline";
}

function statusLabel(s: DocumentStatus) {
 switch (s) {
 case "UPLOADED":
 return "enviado";
 case "PARSING":
 return "lendo";
 case "CHUNKING":
 return "segmentando";
 case "EMBEDDING":
 return "indexando";
 case "INDEXED":
 return "pronto";
 case "FAILED":
 return "falhou";
 default:
 return s;
 }
}

export function ProcessDocuments(props: { processId: string }) {
 const { processId } = props;
 const [docs, setDocs] = useState<DocRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [tick, setTick] = useState(0);

 const hasRunning = useMemo(
 () =>
 docs.some(
 (d) =>
 d.status === "PARSING" ||
 d.status === "CHUNKING" ||
 d.status === "EMBEDDING",
 ),
 [docs],
 );

 const fetchDocs = useCallback(async () => {
 const res = await fetch(`/api/processes/${processId}/documents`, { cache: "no-store" });
 if (!res.ok) throw new Error(await res.text());
 const data = (await res.json()) as { documents: DocRow[] };
 setDocs(data.documents);
 }, [processId]);

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 fetchDocs()
 .catch((e) => {
 if (cancelled) return;
 toast.error(e instanceof Error ? e.message : "Falha ao carregar documentos");
 })
 .finally(() => {
 if (cancelled) return;
 setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [fetchDocs, tick]);

 useEffect(() => {
 if (!hasRunning) return;
 const t = setInterval(() => setTick((x) => x + 1), 1500);
 return () => clearInterval(t);
 }, [hasRunning]);

 const reprocess = useCallback(async (documentId: string) => {
 try {
 const res = await fetch(`/api/documents/${documentId}/reprocess`, { method: "POST" });
 if (!res.ok) throw new Error(await res.text());
 toast.success("Reprocessamento iniciado.");
 setTick((x) => x + 1);
 } catch (e) {
 toast.error(e instanceof Error ? e.message : "Falha ao reprocessar");
 }
 }, []);

 return (
 <div className="space-y-4">
 <DocumentDropzone processId={processId} onUploaded={() => setTick((x) => x + 1)} />

 <Card>
 <CardHeader className="flex flex-row items-center justify-between gap-2">
 <div>
 <CardTitle className="text-base">Documentos do processo</CardTitle>
 <p className="text-xs text-muted-foreground">
 Um documento só “entra no chat” quando estiver <span className="text-[color:var(--text-primary)]">pronto</span>.
 </p>
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setTick((x) => x + 1)}
 disabled={loading}
 >
 {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
 Atualizar
 </Button>
 </CardHeader>
 <CardContent className="space-y-2 text-sm">
 {loading && docs.length === 0 ? (
 <p className="text-muted-foreground">Carregando…</p>
 ) : null}

 {!loading && docs.length === 0 ? (
 <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="font-medium">Envie seu primeiro documento</p>
 <p className="text-xs text-muted-foreground">
 Ex.: despacho, decisão, inicial, contestação, laudo.
 </p>
 </div>
 ) : null}

 {docs.map((d) => {
 const pct = Math.max(0, Math.min(100, Math.round((d.progress ?? 0) * 100)));
 const canUse = d.status === "INDEXED";
 const isFailed = d.status === "FAILED";
 const running =
 d.status === "PARSING" || d.status === "CHUNKING" || d.status === "EMBEDDING";

 return (
 <div
 key={d.id}
 className={cn("rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3",
 isFailed && "border-red-500/20",
 )}
 >
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <FileText className="size-4 opacity-70" />
 <p className="truncate font-medium">{d.originalName}</p>
 <Badge
 variant={statusTone(d.status)}
 className={cn("text-[10px]", isFailed && "border-red-500/30 text-red-200")}
 >
 {statusLabel(d.status)}
 </Badge>
 {canUse ? (
 <Badge variant="outline" className="text-[10px] text-emerald-200">
 disponível na IA
 </Badge>
 ) : null}
 </div>
 <div className="mt-1 text-xs text-muted-foreground">
 {d.mimeType} · {(d.sizeBytes / 1024 / 1024).toFixed(2)} MB
 {d.totalChunks ? (
 <span>
 {" "}
 · chunks: {d.processedChunks ?? 0}/{d.totalChunks}
 </span>
 ) : null}
 </div>
 </div>

 <div className="flex flex-wrap gap-2">
 <Button asChild variant="outline" size="sm">
 <Link href={`/processos/${processId}/documentos/${d.id}`}>
 <Eye className="mr-2 size-4" />
 Abrir
 </Link>
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => void reprocess(d.id)}
 disabled={running}
 >
 <RefreshCw className="mr-2 size-4" />
 Reprocessar
 </Button>
 <Button asChild variant="secondary" size="sm" disabled={!canUse}>
 <Link href={`/processos/${processId}?chat=1&q=${encodeURIComponent(`Pergunta sobre o documento ${d.originalName}: `)}`}>
 <MessageSquare className="mr-2 size-4" />
 Usar no chat
 </Link>
 </Button>
 </div>
 </div>

 {running ? (
 <div className="mt-3 space-y-1">
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>Processando…</span>
 <span>{pct}%</span>
 </div>
 <Progress value={pct} />
 </div>
 ) : null}

 {isFailed ? (
 <p className="mt-2 text-xs text-red-300">
 {d.errorMessage ? `Erro: ${d.errorMessage}` : "Falha no processamento."}
 </p>
 ) : null}
 </div>
 );
 })}
 </CardContent>
 </Card>
 </div>
 );
}

