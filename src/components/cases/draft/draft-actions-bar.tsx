/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
 ArrowRight,
 Copy,
 Download,
 FileText,
 Loader2,
 Save,
 Sparkles,
 Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
 caseId: string;
 draftId: string | null;
 content: string;
 confirmUnverified: boolean;
 onRefresh: () => Promise<void>;
 onDraftIdChange: (id: string) => void;
};

export function DraftActionsBar({
 caseId,
 draftId,
 content,
 confirmUnverified,
 onRefresh,
 onDraftIdChange,
}: Props) {
 const router = useRouter();
 const [busy, setBusy] = useState<string | null>(null);

 async function postJson(url: string, body?: unknown) {
 const res = await fetch(url, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: body ? JSON.stringify(body) : "{}",
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 if (data.status === "blocked" && Array.isArray(data.reasons)) {
 throw new Error(data.reasons.join(" "));
 }
 throw new Error(data.error ?? data.message ?? `Erro HTTP ${res.status}`);
 }
 return data;
 }

 return (
 <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-3 py-2">
 <Button
 type="button"
 size="sm"
 variant="default"
 disabled={!!busy || !!draftId}
 onClick={async () => {
 setBusy("create-draft");
 try {
 const data = await postJson(`/api/cases/${caseId}/drafts`, {
 confirmUnverifiedFoundations: confirmUnverified,
 });
 if (data.draft?.id) onDraftIdChange(data.draft.id);
 toast.success("Minuta criada.");
 await onRefresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }}
 >
 {busy === "create-draft" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
 <span className="ml-1.5">Criar minuta (JustOS AI)</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="secondary"
 disabled={!!busy}
 onClick={async () => {
 setBusy("strategy");
 try {
 await postJson(`/api/cases/${caseId}/strategy/generate`);
 toast.success("Estratégia assistida atualizada.");
 await onRefresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }}
 >
 {busy === "strategy" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
 <span className="ml-1.5">Gerar estratégia (JustOS AI)</span>
 </Button>

 <Button
 type="button"
 size="sm"
 disabled={!draftId || !!busy}
 onClick={async () => {
 if (!draftId) return;
 setBusy("piece");
 try {
 const data = await postJson(`/api/cases/${caseId}/drafts/${draftId}/generate`, {
 confirmUnverifiedFoundations: confirmUnverified,
 });
 if (data.draft?.id) onDraftIdChange(data.draft.id);
 toast.success("Minuta gerada.");
 await onRefresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }}
 >
 {busy === "piece" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
 <span className="ml-1.5">Redigir minuta (JustOS AI)</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="outline"
 disabled={!draftId || !!busy}
 onClick={async () => {
 if (!draftId) return;
 setBusy("review");
 try {
 await postJson(`/api/cases/${caseId}/drafts/${draftId}/review`);
 toast.success("Revisão registrada.");
 await onRefresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }}
 >
 {busy === "review" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
 <span className="ml-1.5">Revisar minuta (JustOS AI)</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="secondary"
 disabled={!draftId || content.length < 80 || !!busy}
 onClick={async () => {
 if (!draftId) return;
 setBusy("promote");
 try {
 const data = await postJson(`/api/cases/${caseId}/drafts/${draftId}/promote`);
 if (data.pieceId) {
 toast.success("Abrindo editor avançado…");
 router.push(`/editor/${data.pieceId}`);
 }
 await onRefresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }}
 >
 {busy === "promote" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
 <span className="ml-1.5">Editor final</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="outline"
 disabled={!draftId || !!busy}
 onClick={() => {
 if (!draftId) return;
 window.location.assign(`/api/cases/${caseId}/drafts/${draftId}/export?format=docx`);
 }}
 >
 <Download className="size-4" />
 <span className="ml-1.5">DOCX</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="outline"
 disabled={!draftId || !!busy}
 onClick={() => {
 if (!draftId) return;
 window.location.assign(`/api/cases/${caseId}/drafts/${draftId}/export?format=pdf`);
 }}
 >
 <Download className="size-4" />
 <span className="ml-1.5">PDF</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="ghost"
 disabled={!draftId || !!busy}
 onClick={() => {
 if (!draftId) return;
 window.location.assign(`/api/cases/${caseId}/drafts/${draftId}/export?format=md`);
 }}
 >
 <FileText className="size-4" />
 <span className="ml-1.5">Markdown</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="ghost"
 disabled={!content || !!busy}
 onClick={async () => {
 try {
 await navigator.clipboard.writeText(content);
 toast.success("Texto copiado.");
 } catch {
 toast.error("Não foi possível copiar automaticamente.");
 }
 }}
 >
 <Copy className="size-4" />
 <span className="ml-1.5">Copiar texto</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="default"
 disabled={!draftId || content.length < 50 || !!busy}
 onClick={async () => {
 if (!draftId) return;
 setBusy("save");
 try {
 const res = await fetch(`/api/cases/${caseId}/drafts/${draftId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ content }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");
 if (data.draft?.id) onDraftIdChange(data.draft.id);
 toast.success("Nova versão salva.");
 await onRefresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }}
 >
 {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
 <span className="ml-1.5">Salvar edição</span>
 </Button>

 <Button type="button" size="sm" variant="ghost" disabled title="Disponível em versão futura">
 Salvar como modelo
 </Button>
 </div>
 );
}
