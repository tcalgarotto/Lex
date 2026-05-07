"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send, ShieldCheck } from "lucide-react";
import type {
  CaseAnnotation,
  CaseComment,
  DraftApproval,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type CommentsResp = { comments: CaseComment[] };
type AnnotationsResp = { annotations: CaseAnnotation[] };
type ApprovalsResp = { approvals: DraftApproval[] };

export function CaseCollabTab({ caseId }: { caseId: string }) {
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [annotations, setAnnotations] = useState<CaseAnnotation[]>([]);
  const [approvals, setApprovals] = useState<DraftApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a, ap] = await Promise.all([
        fetch(`/api/cases/${caseId}/comments`).then((r) => r.json() as Promise<CommentsResp>),
        fetch(`/api/cases/${caseId}/annotations`).then((r) => r.json() as Promise<AnnotationsResp>),
        fetch(`/api/cases/${caseId}/approvals`).then((r) => r.json() as Promise<ApprovalsResp>),
      ]);
      setComments(c.comments ?? []);
      setAnnotations(a.annotations ?? []);
      setApprovals(ap.approvals ?? []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitComment = useCallback(async () => {
    if (body.trim().length < 1) return;
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `falha ${res.status}`);
      return;
    }
    setBody("");
    await load();
  }, [body, caseId, load]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="size-4" /> Colaboração interna
        </h2>
        {loading ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> carregando…
          </span>
        ) : null}
      </header>

      <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Comentário interno (visível para o workspace)…"
          rows={3}
          data-testid="collab-comment-input"
        />
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submitComment} data-testid="collab-comment-submit">
            <Send className="mr-2 size-3.5" /> Publicar comentário
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Comentários ({comments.length})
        </h3>
        <ul className="space-y-2">
          {comments.length === 0 ? (
            <li className="rounded-md border border-dashed border-white/10 p-4 text-center text-xs text-muted-foreground">
              Sem comentários ainda — abra a colaboração para sua equipe.
            </li>
          ) : (
            comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-white/10 bg-zinc-950/40 p-3"
                data-testid="collab-comment-item"
              >
                <header className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">{c.authorId.slice(0, 8)}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{c.visibility}</Badge>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </header>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
                {c.refChunkIds.length ? (
                  <p className="mt-1 font-mono text-[10px] text-indigo-300">
                    refs: {c.refChunkIds.slice(0, 4).join(", ")}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Aprovações ({approvals.length})
          </h3>
          {approvals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem pedidos de aprovação no momento.</p>
          ) : (
            <ul className="space-y-2">
              {approvals.map((a) => (
                <li key={a.id} className="rounded-md border border-white/5 bg-zinc-950/30 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{a.status}</Badge>
                    <span className="font-mono opacity-60">{a.draftId.slice(0, 8)}</span>
                    <span className="opacity-60">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  {a.rationale ? (
                    <p className="mt-1 text-muted-foreground">{a.rationale}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-3">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Anotações ({annotations.length})
          </h3>
          {annotations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Anote trechos da minuta com kind=HIGHLIGHT/WEAKNESS/STRENGTH/TODO/CITATION.
            </p>
          ) : (
            <ul className="space-y-1">
              {annotations.slice(0, 12).map((a) => (
                <li key={a.id} className="rounded-md border border-white/5 bg-zinc-950/30 p-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                  <span className="ml-2 opacity-80">{a.excerpt.slice(0, 160)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
