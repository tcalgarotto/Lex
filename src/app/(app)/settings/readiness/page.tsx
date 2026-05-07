import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";

type Status = "OK" | "Pendente" | "Erro";

function row(label: string, status: Status, detail?: string) {
  const tone =
    status === "OK"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status === "Erro"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-3">
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
    // Smoke: uma busca vazia deve falhar? Usamos delete-by-documentId inexistente como no-op.
    const store = getQdrantVectorStore();
    await store.deleteByDocumentId("__readiness_noop__");
    qdrantStatus = { status: "OK", detail: "conexão OK" };
  } catch (e) {
    qdrantStatus = { status: "Erro", detail: e instanceof Error ? e.message : "Erro" };
  }

  return (
    <AppShell title="Prontidão do ambiente">
      <div className="space-y-6">
        <Card className="border-white/10 bg-zinc-900/40">
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
      </div>
    </AppShell>
  );
}

