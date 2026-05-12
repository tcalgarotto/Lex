"use client";

import { useCallback, useState } from "react";
import { Brain, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BrainGet = {
 lawyerBrain: unknown;
 winningSamples: Array<{ id: string; title: string }>;
 styleMemory: Array<{ id: string; title: string | null }>;
};

export function LawyerBrainCard({
 initial,
 onRefresh,
}: {
 initial: BrainGet | null;
 onRefresh: () => Promise<void>;
}) {
 const [title, setTitle] = useState("");
 const [body, setBody] = useState("");
 const [loading, setLoading] = useState(false);
 const [err, setErr] = useState<string | null>(null);

 const ingest = useCallback(async () => {
 if (body.trim().length < 80) {
 setErr("Cole pelo menos 80 caracteres da peça.");
 return;
 }
 setLoading(true);
 setErr(null);
 try {
 const res = await fetch("/api/lawyer-brain/ingest", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({
 title: title.trim() || "Peça vencedora",
 body,
 }),
 });
 if (!res.ok) {
 const j = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(j.error ?? `erro ${res.status}`);
 }
 setBody("");
 setTitle("");
 await onRefresh();
 } catch (e) {
 setErr((e as Error).message);
 } finally {
 setLoading(false);
 }
 }, [body, title, onRefresh]);

 const lb = initial?.lawyerBrain as {
 preferredCitations?: string[];
 samplesCount?: number;
 writingFingerprint?: { estimatedTone?: string; avgSentenceLength?: number };
 } | null;

 return (
 <Card className="space-y-3 p-4">
 <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
 <Brain className="size-3.5" /> Lawyer Style Brain
 </div>
 {lb ? (
 <div className="grid gap-2 text-[11px] text-muted-foreground md:grid-cols-2">
 <p>
 Amostras agregadas: <strong className="text-foreground">{lb.samplesCount ?? "—"}</strong>
 </p>
 <p>
 Tom estimado:{" "}
 <strong className="text-foreground">{lb.writingFingerprint?.estimatedTone ?? "—"}</strong>
 </p>
 <p className="md:col-span-2">
 URNs preferidas (top 6):{" "}
 <span className="break-all font-mono text-[10px] text-indigo-200">
 {(lb.preferredCitations ?? []).slice(0, 6).join(" · ") || "—"}
 </span>
 </p>
 </div>
 ) : (
 <p className="text-xs text-muted-foreground">Nenhum fingerprint persistente ainda — envie uma peça.</p>
 )}
 <div className="space-y-2 border-t border-[color:var(--border-default)] pt-3">
 <Input
 placeholder="Título da peça (opcional)"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 className="text-sm"
 />
 <Textarea
 placeholder="Cole aqui a íntegra ou trechos substanciais (markdown ou texto)..."
 value={body}
 onChange={(e) => setBody(e.target.value)}
 className="min-h-[140px] font-mono text-[12px]"
 data-testid="lawyer-brain-upload"
 />
 <Button type="button" onClick={ingest} disabled={loading} size="sm">
 {loading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Upload className="mr-1 size-3" />}
 Ingerir peça vencedora
 </Button>
 {err ? <p className="text-xs text-rose-300">{err}</p> : null}
 </div>
 {initial?.winningSamples?.length ? (
 <div className="text-[10px] text-muted-foreground">
 Recentes: {initial.winningSamples.map((s) => s.title).slice(0, 3).join(" · ")}
 </div>
 ) : null}
 </Card>
 );
}
