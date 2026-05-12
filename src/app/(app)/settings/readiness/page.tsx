import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { snapshotProviderStatuses } from "@/lib/corpus/providers/registry";

type Status = "OK" | "Pendente" | "Erro";

function row(label: string, status: Status, detail?: string) {
 const tone =
 status === "OK"
 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
 : status === "Erro"
 ? "border-red-500/30 bg-red-500/10 text-red-200"
 : "border-amber-500/30 bg-amber-500/10 text-amber-200";
 return (
 <div className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-3">
 <div className="min-w-0">
 <p className="font-medium">{label}</p>
 {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
 </div>
 <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${tone}`}>{status}</span>
 </div>
 );
}

export default async function ReadinessPage() {
 await getWorkspaceContextWithRole();

 const envOk: Array<{ label: string; ok: boolean; detail?: string }> = [];
 try {
 const env = getEnv();
 envOk.push({ label: "Supabase URL/Anon", ok: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) });
 envOk.push({ label: "Database URL", ok: Boolean(env.DATABASE_URL) });
 envOk.push({ label: "Qdrant", ok: Boolean(env.QDRANT_URL) });
 envOk.push({ label: "Redis", ok: Boolean(env.REDIS_URL) });
 envOk.push({ label: "Embeddings (DeepInfra)", ok: Boolean(env.DEEPINFRA_API_KEY) });
 envOk.push({ label: "Chat provider", ok: Boolean(env.AI_CHAT_PROVIDER) });
 } catch (e) {
 envOk.push({ label: "Env vars", ok: false, detail: e instanceof Error ? e.message : "Erro" });
 }

 let redisStatus: { status: Status; detail?: string } = { status: "Pendente" };
 try {
 const r = getRedis();
 if (!r) {
 redisStatus = { status: "Pendente", detail: "REDIS_URL ausente — modo no-cache" };
 } else {
 const pong = await r.ping();
 redisStatus = { status: pong ? "OK" : "Erro", detail: pong ? "ping OK" : "sem resposta" };
 }
 } catch (e) {
 redisStatus = { status: "Erro", detail: e instanceof Error ? e.message : "Erro" };
 }

 let qdrantStatus: { status: Status; detail?: string } = { status: "Pendente" };
 try {
 // Smoke check: deleta IDs inexistentes (no-op) só pra exercitar a
 // conexão. Passamos workspaceId fictício porque a interface exige
 // — o Qdrant não vai casar nada e o delete é seguro.
 const store = getQdrantVectorStore();
 await store.deleteByDocumentId("__readiness_noop__", "__readiness_noop__");
 qdrantStatus = { status: "OK", detail: "conexão OK" };
 } catch (e) {
 qdrantStatus = { status: "Erro", detail: e instanceof Error ? e.message : "Erro" };
 }

 let providerStatuses: ReturnType<typeof snapshotProviderStatuses> = [];
 try {
 providerStatuses = snapshotProviderStatuses();
 } catch {
 providerStatuses = [];
 }

 function providerRow(p: (typeof providerStatuses)[number]) {
 const status: Status =
 p.status === "ok"
 ? "OK"
 : p.status === "disabled" || p.status === "not_configured"
 ? "Pendente"
 : "Erro";
 const detailParts = [
 `mode=${p.mode}`,
 p.detail,
 p.hint,
 p.rateLimitPerMinute ? `RL ${p.rateLimitPerMinute}/min` : null,
 ].filter(Boolean);
 return row(p.label, status, detailParts.join(" · "));
 }

 return (
 <AppShell title="Prontidão do ambiente">
 <div className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Checklist</CardTitle>
 <p className="text-sm text-muted-foreground">
 Ajuda a validar se o Lex está pronto para uma demo com advogado (sem surpresas).
 </p>
 </CardHeader>
 <CardContent className="space-y-2 text-sm">
 {envOk.map((i) =>
 row(i.label, i.ok ? "OK" : "Erro", i.detail),
 )}
 {row("Redis conectado", redisStatus.status, redisStatus.detail)}
 {row("Qdrant conectado", qdrantStatus.status, qdrantStatus.detail)}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Provedores jurídicos (corpus indexado)</CardTitle>
 <p className="text-sm text-muted-foreground">
 Status do registry. DataJud aparece como <span className="font-mono">not_configured</span> até receber chave do CNJ.
 </p>
 </CardHeader>
 <CardContent className="space-y-2 text-sm">
 {providerStatuses.length === 0 ? (
 <p className="text-muted-foreground">Registry indisponível.</p>
 ) : (
 providerStatuses.map((p) => providerRow(p))
 )}
 </CardContent>
 </Card>
 </div>
 </AppShell>
 );
}

