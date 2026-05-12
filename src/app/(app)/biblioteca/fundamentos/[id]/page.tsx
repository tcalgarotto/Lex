"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SetPageTitle } from "@/components/app/set-page-title";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Foundation = {
 id: string;
 title: string;
 contentMd: string;
 tags: string[];
 optInRag: boolean;
 optInMemory: boolean;
 useAsModel: boolean;
 useAsStyle: boolean;
 archivedAt: string | null;
};

type Patch = Partial<Pick<Foundation, "title" | "contentMd" | "tags" | "optInRag" | "optInMemory" | "useAsModel" | "useAsStyle">> & {
 archived?: boolean;
};

export default function FoundationDetailPage() {
 const params = useParams<{ id: string }>();
 const router = useRouter();
 const id = params.id;

 const [f, setF] = useState<Foundation | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const tagString = useMemo(() => (f?.tags ?? []).join(", "), [f?.tags]);

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 fetch(`/api/library/foundations/${id}`, { method: "GET" })
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error ?? "Falha ao carregar");
 return j.foundation as Foundation;
 })
 .then((data) => {
 if (!cancelled) setF(data);
 })
 .catch((e) => {
 if (!cancelled) setError(e instanceof Error ? e.message : String(e));
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [id]);

 async function save(patch: Patch) {
 setSaving(true);
 setError(null);
 try {
 const res = await fetch(`/api/library/foundations/${id}`, {
 method: "PATCH",
 headers: { "content-type": "application/json" },
 body: JSON.stringify(patch),
 });
 const json = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar.");
 router.refresh?.();
 } catch (e) {
 setError(e instanceof Error ? e.message : String(e));
 } finally {
 setSaving(false);
 }
 }

 async function archiveToggle() {
 if (!f) return;
 await save({ archived: !Boolean(f.archivedAt) });
 setF({ ...f, archivedAt: f.archivedAt ? null : new Date().toISOString() });
 }

 async function hardDelete() {
 if (!confirm("Excluir definitivamente este fundamento?")) return;
 const res = await fetch(`/api/library/foundations/${id}?confirm=1`, { method: "DELETE" });
 if (res.ok) router.push("/biblioteca");
 else {
 const j = await res.json().catch(() => ({}));
 setError(j.error ?? "Falha ao excluir.");
 }
 }

 if (loading) {
 return (
 <>
 <SetPageTitle title="Fundamento" />
 <div className="w-full min-w-0">
 <Card className="p-4">Carregando…</Card>
 </div>
 </>
 );
 }

 if (!f) {
 return (
 <>
 <SetPageTitle title="Fundamento" />
 <div className="w-full min-w-0 space-y-3">
 <Card className="p-4">
 <p className="text-sm text-muted-foreground">{error ?? "Fundamento não encontrado."}</p>
 </Card>
 <Button asChild variant="outline">
 <Link href="/biblioteca">Voltar</Link>
 </Button>
 </div>
 </>
 );
 }

 return (
 <>
 <SetPageTitle title={f.title} />
 <div className="w-full min-w-0 space-y-6">
 <header className="flex flex-wrap items-start justify-between gap-3">
 <div className="space-y-1">
 <h1 className="text-2xl font-semibold">{f.title}</h1>
 <div className="flex flex-wrap items-center gap-2">
 {f.optInRag ? <Badge>Busca assistida</Badge> : <Badge variant="outline">Busca assistida: desligada</Badge>}
 {f.optInMemory ? <Badge variant="secondary">Memória</Badge> : <Badge variant="outline">Memória: desativada</Badge>}
 {f.archivedAt ? <Badge variant="secondary">Arquivado</Badge> : null}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="outline" onClick={archiveToggle} disabled={saving}>
 {f.archivedAt ? "Restaurar" : "Arquivar"}
 </Button>
 <Button variant="destructive" onClick={hardDelete}>
 Excluir
 </Button>
 </div>
 </header>

 <Card className="space-y-4 p-4">
 <div className="space-y-2">
 <label className="text-sm font-medium">Título</label>
 <Input
 value={f.title}
 onChange={(e) => setF({ ...f, title: e.target.value })}
 onBlur={() => save({ title: f.title })}
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium">Tags</label>
 <Input
 value={tagString}
 onChange={(e) => setF({ ...f, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
 onBlur={() => save({ tags: f.tags })}
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium">Conteúdo (Markdown)</label>
 <Textarea
 value={f.contentMd}
 onChange={(e) => setF({ ...f, contentMd: e.target.value })}
 onBlur={() => save({ contentMd: f.contentMd })}
 rows={14}
 />
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <Button
 type="button"
 variant={f.optInRag ? "default" : "outline"}
 onClick={async () => {
 const next = !f.optInRag;
 setF({ ...f, optInRag: next });
 await save({ optInRag: next });
 }}
 disabled={saving}
 >
 {f.optInRag ? "Busca assistida: ligada" : "Busca assistida: desligada"}
 </Button>
 <Button
 type="button"
 variant={f.optInMemory ? "default" : "outline"}
 onClick={async () => {
 const next = !f.optInMemory;
 setF({ ...f, optInMemory: next });
 await save({ optInMemory: next });
 }}
 disabled={saving}
 >
 {f.optInMemory ? "Memória: ativada" : "Memória: desativada"}
 </Button>
 <Badge variant="secondary">Opt-in obrigatório</Badge>
 </div>

 {error ? <p className="text-sm text-red-400">{error}</p> : null}
 </Card>
 </div>
 </>
 );
}

