"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 ExternalLink,
 Eye,
 FileText,
 Link2,
 RefreshCcw,
 Sparkles,
 Trash2,
 Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 deriveDocumentDisplayStatus,
 type DocumentDisplayKind,
} from "@/lib/documents/status-display";
import type { DocumentStatus } from "@prisma/client";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import { translateTerm } from "@/lib/ui/product-terminology";

export interface CaseDocSummary {
 id: string;
 originalName: string;
 status: DocumentStatus;
 updatedAt: string | Date;
 totalChunks: number | null;
 processedChunks: number | null;
 processId: string | null;
 caseId: string | null;
}

interface UnlinkedDoc {
 id: string;
 originalName: string;
 status: DocumentStatus;
 updatedAt: string | Date;
}

interface Props {
 caseId: string;
 documents: CaseDocSummary[];
}

export function CaseDocumentsTab({ caseId, documents }: Props) {
 const router = useRouter();
 const [busy, setBusy] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [confirmDelete, setConfirmDelete] = useState<CaseDocSummary | null>(null);
 const [linkOpen, setLinkOpen] = useState(false);
 const [textDoc, setTextDoc] = useState<CaseDocSummary | null>(null);
 const [extractedText, setExtractedText] = useState<string | null>(null);
 const [textLoading, setTextLoading] = useState(false);
 const [textError, setTextError] = useState<string | null>(null);

 async function reprocess(id: string) {
 setError(null);
 setBusy(id);
 try {
 const res = await fetch(`/api/documents/${id}/reprocess`, { method: "POST" });
 if (!res.ok) throw new Error(`status=${res.status}`);
 router.refresh();
 } catch (e) {
 setError(`Falha ao reprocessar: ${e instanceof Error ? e.message : String(e)}`);
 } finally {
 setBusy(null);
 }
 }

 async function unlink(id: string) {
 setError(null);
 setBusy(id);
 try {
 const res = await fetch(`/api/documents/${id}/link-case`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ caseId: null }),
 });
 if (!res.ok) throw new Error(`status=${res.status}`);
 router.refresh();
 } catch (e) {
 setError(`Falha ao desvincular: ${e instanceof Error ? e.message : String(e)}`);
 } finally {
 setBusy(null);
 }
 }

 async function loadExtractedText(doc: CaseDocSummary) {
 setTextDoc(doc);
 setExtractedText(null);
 setTextError(null);
 setTextLoading(true);
 try {
 const res = await fetch(`/api/documents/${doc.id}`);
 if (!res.ok) throw new Error(`status=${res.status}`);
 const json = (await res.json()) as {
 document?: { extractedText?: string | null };
 chunks?: { text: string }[];
 };
 const t = json.document?.extractedText?.trim();
 if (t) {
 setExtractedText(t);
 return;
 }
 const stitched = (json.chunks ?? []).map((c) => c.text).join("\n\n").trim();
 setExtractedText(
 stitched || "Texto ainda não disponível para este documento.",
 );
 } catch (e) {
 setTextError(e instanceof Error ? e.message : "Falha ao carregar o texto");
 } finally {
 setTextLoading(false);
 }
 }

 async function confirmDeletion() {
 if (!confirmDelete) return;
 const id = confirmDelete.id;
 setError(null);
 setBusy(id);
 try {
 const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
 if (!res.ok) throw new Error(`status=${res.status}`);
 setConfirmDelete(null);
 router.refresh();
 } catch (e) {
 setError(`Falha ao excluir: ${e instanceof Error ? e.message : String(e)}`);
 } finally {
 setBusy(null);
 }
 }

 if (documents.length === 0) {
 return (
 <>
 <EmptyState
 icon={<FileText className="size-5" />}
 title="Nenhum documento neste caso"
 description="Carregue petições, despachos, contratos ou provas — ou vincule um ficheiro que já existe na área Documentos deste workspace."
 secondaryAction={{
 label: "Vincular existente",
 onClick: () => setLinkOpen(true),
 variant: "outline",
 }}
 >
 <div className="mt-4 flex justify-center">
 <DocumentUploadButton caseId={caseId} label="Enviar documento para este caso" />
 </div>
 </EmptyState>
 <LinkExistingDialog
 open={linkOpen}
 onOpenChange={setLinkOpen}
 caseId={caseId}
 onLinked={() => router.refresh()}
 />
 </>
 );
 }

 return (
 <div className="space-y-3">
 {error ? (
 <Card className="border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
 {error}
 </Card>
 ) : null}

 <div className="flex flex-wrap items-center justify-end gap-2">
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => setLinkOpen(true)}
 data-testid="case-link-existing"
 >
 <Link2 className="mr-1 size-3" /> Vincular existente
 </Button>
 <DocumentUploadButton caseId={caseId} label="Enviar documento para este caso" />
 </div>

 <ul className="space-y-2">
 {documents.map((d) => {
 const status = deriveDocumentDisplayStatus({
 status: d.status,
 updatedAt: d.updatedAt,
 });
 return (
 <li key={d.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <p className="truncate font-medium">{d.originalName}</p>
 <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
 <StatusChip kind={status.kind} label={status.label} />
 {d.totalChunks !== null ? (
 <span>
 {d.processedChunks ?? 0}/{d.totalChunks} trechos indexados
 </span>
 ) : null}
 <span>
 Atualizado {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
 </span>
 </div>
 </div>
 <div className="flex flex-wrap gap-1">
 <Button
 type="button"
 variant="ghost"
 size="sm"
 aria-label="Ver texto extraído"
 onClick={() => void loadExtractedText(d)}
 >
 <Eye className="size-3" aria-hidden />
 </Button>
 <Button type="button" variant="ghost" size="sm" asChild>
 <Link href={`/cases/${caseId}/estrategia`} aria-label="Gerar sugestões na estratégia">
 <Sparkles className="size-3" aria-hidden />
 </Link>
 </Button>
 <Button type="button" variant="ghost" size="sm" asChild>
 <Link href={`/cases/${caseId}/partes-fatos`} aria-label="Vincular a fato">
 <Link2 className="size-3" aria-hidden />
 </Link>
 </Button>
 <Button type="button" variant="ghost" size="sm" asChild>
 <Link href={`/cases/${caseId}/partes-fatos`} aria-label="Usar como prova">
 <FileText className="size-3" aria-hidden />
 </Link>
 </Button>
 {d.processId ? (
 <Button asChild variant="ghost" size="sm">
 <Link href={`/processos/${d.processId}/documentos/${d.id}`}>
 <ExternalLink className="size-3" aria-label="Abrir no processo" />
 </Link>
 </Button>
 ) : null}
 <Button
 variant="ghost"
 size="sm"
 disabled={busy === d.id}
 onClick={() => reprocess(d.id)}
 aria-label="Tentar novamente o processamento"
 >
 <RefreshCcw className="size-3" aria-hidden />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 disabled={busy === d.id}
 onClick={() => unlink(d.id)}
 aria-label="Desvincular do caso"
 >
 <Unlink className="size-3" aria-hidden />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 disabled={busy === d.id}
 onClick={() => setConfirmDelete(d)}
 aria-label="Excluir documento"
 className="text-rose-300 hover:text-rose-200"
 data-testid={`document-delete-${d.id}`}
 >
 <Trash2 className="size-3" aria-hidden />
 </Button>
 </div>
 </div>
 </Card>
 </li>
 );
 })}
 </ul>

 <LinkExistingDialog
 open={linkOpen}
 onOpenChange={setLinkOpen}
 caseId={caseId}
 onLinked={() => router.refresh()}
 />

 <Dialog open={!!textDoc} onOpenChange={(open) => !open && setTextDoc(null)}>
 <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
 <DialogHeader>
 <DialogTitle>Texto extraído</DialogTitle>
 </DialogHeader>
 {textLoading ? (
 <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
 Carregando…
 </p>
 ) : textError ? (
 <p className="text-sm text-rose-200" role="alert">
 {textError}
 </p>
 ) : (
 <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
 {extractedText}
 </pre>
 )}
 </DialogContent>
 </Dialog>

 <Dialog
 open={!!confirmDelete}
 onOpenChange={(open) => !open && setConfirmDelete(null)}
 >
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Excluir documento</DialogTitle>
 </DialogHeader>
 <p className="text-sm text-muted-foreground">
 Tem certeza que deseja excluir{" "}
 <span className="font-medium text-foreground">
 {confirmDelete?.originalName}
 </span>
 ? Esta ação remove o arquivo, os trechos indexados e as entradas associadas na{" "}
 {translateTerm("Qdrant")}.
 <span className="mt-2 block text-rose-200">Esta operação não pode ser desfeita.</span>
 </p>
 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="ghost"
 onClick={() => setConfirmDelete(null)}
 disabled={busy === confirmDelete?.id}
 >
 Cancelar
 </Button>
 <Button
 type="button"
 variant="destructive"
 onClick={confirmDeletion}
 disabled={busy === confirmDelete?.id}
 data-testid="document-delete-confirm"
 >
 <Trash2 className="mr-1 size-3" /> Excluir definitivamente
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}

const KIND_TONE: Record<DocumentDisplayKind, string> = {
 ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
 progress: "border-blue-500/30 bg-blue-500/10 text-blue-200",
 warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
 error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

function StatusChip({ kind, label }: { kind: DocumentDisplayKind; label: string }) {
 return (
 <Badge variant="outline" className={`text-[10px] ${KIND_TONE[kind]}`}>
 {label}
 </Badge>
 );
}

function LinkExistingDialog({
 open,
 onOpenChange,
 caseId,
 onLinked,
}: {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 caseId: string;
 onLinked: () => void;
}) {
 const [docs, setDocs] = useState<UnlinkedDoc[] | null>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [linkingId, setLinkingId] = useState<string | null>(null);

 useEffect(() => {
 if (!open) return;
 setLoading(true);
 setError(null);
 fetch(`/api/documents?unlinked=1&take=50`)
 .then(async (r) => {
 if (!r.ok) throw new Error(`HTTP ${r.status}`);
 const data = (await r.json()) as { documents?: UnlinkedDoc[] };
 setDocs(data.documents ?? []);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : String(e));
 })
 .finally(() => setLoading(false));
 }, [open]);

 async function link(docId: string) {
 setError(null);
 setLinkingId(docId);
 try {
 const res = await fetch(`/api/documents/${docId}/link-case`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ caseId }),
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 setDocs((prev) => (prev ? prev.filter((d) => d.id !== docId) : prev));
 onLinked();
 } catch (e) {
 setError(e instanceof Error ? e.message : String(e));
 } finally {
 setLinkingId(null);
 }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Vincular documento existente</DialogTitle>
 </DialogHeader>
 <p className="text-xs text-muted-foreground">
 Documentos do workspace que ainda não estão vinculados a nenhum caso.
 </p>
 {loading ? (
 <div className="space-y-2">
 {[0, 1, 2].map((i) => (
 <Card key={i} className="h-14 animate-pulse" />
 ))}
 </div>
 ) : error ? (
 <Card className="border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
 {error}
 </Card>
 ) : !docs || docs.length === 0 ? (
 <Card className="p-4 text-sm text-muted-foreground">
 Nenhum documento sem caso encontrado.
 </Card>
 ) : (
 <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
 {docs.map((d) => {
 const disp = deriveDocumentDisplayStatus({
 status: d.status,
 updatedAt: d.updatedAt,
 });
 return (
 <li key={d.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium">{d.originalName}</p>
 <p className="text-[11px] text-muted-foreground">
 {disp.label} · atualizado{" "}
 {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
 </p>
 </div>
 <Button
 type="button"
 size="sm"
 onClick={() => link(d.id)}
 disabled={linkingId === d.id}
 >
 {linkingId === d.id ? "Vinculando…" : "Vincular ao caso"}
 </Button>
 </div>
 </Card>
 </li>
 );
 })}
 </ul>
 )}
 <div className="flex justify-end">
 <Button asChild variant="ghost" size="sm" className="text-[11px] text-muted-foreground">
 <Link href="/documentos?unlinked=1">Abrir lista completa</Link>
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );
}
