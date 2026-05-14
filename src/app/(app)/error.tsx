"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary do segmento autenticado.
 *
 * Categoriza o erro em 4 buckets para dar contexto útil ao admin/usuário:
 * - auth → sessão expirou, oferecer login.
 * - network → problema momentâneo de rede.
 * - config → env var faltando / Prisma sem DATABASE_URL / Redis off.
 * Mostra dica concreta de o que conferir na Vercel.
 * - unknown → fallback genérico (com a mensagem original visível).
 */
export default function AppSegmentError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 console.error("[app] segment error:", error);
 }, [error]);

 const msg = error.message ?? "";
 const lower = msg.toLowerCase();

 const isAuth = /not authenticated|n\u00e3o autenticado|unauthorized/i.test(msg);
 const isNetwork = /failed to fetch|networkerror|fetch failed/i.test(msg);
 const isConfig =
 /environment variable not found/i.test(msg) ||
 /database_url/i.test(lower) ||
 /prismaclientinitializationerror/i.test(lower) ||
 /can't reach database server/i.test(lower) ||
 /redis_url/i.test(lower);

 let title = "Algo saiu do esperado";
 let body: string = msg || "Erro inesperado.";
 let adminHint: string | null = null;

 if (isAuth) {
 title = "Sua sessão expirou";
 body = "Faça login novamente para continuar.";
 } else if (isNetwork) {
 title = "Falha de rede";
 body = "Não conseguimos falar com o servidor. Verifique sua conexão e tente outra vez.";
 } else if (isConfig) {
 title = "Configuração de produção incompleta";
 body =
 "Esta instância está sem variáveis de ambiente obrigatórias. Um administrador precisa concluir o setup antes que a área autenticada funcione.";
 adminHint = buildAdminHint(msg);
 }

 return (
 <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
 <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h2>
 <p className="mt-2 max-w-md text-sm text-[color:var(--text-secondary)]">{body}</p>

 {adminHint ? (
 <div className="mt-4 max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-left text-xs text-amber-200">
 <p className="font-medium text-amber-100">Para o administrador</p>
 <p className="mt-1 text-amber-200/90">{adminHint}</p>
 <p className="mt-2 text-amber-200/70">
 Confira <code className="font-mono">/api/health</code> para detalhes por componente.
 </p>
 </div>
 ) : null}

 <div className="mt-6 flex gap-2">
 <Button onClick={() => reset()} variant="default">
 Tentar novamente
 </Button>
 {isAuth ? (
 <Button asChild variant="outline">
 <a href="/login">Fazer login</a>
 </Button>
 ) : null}
 {isConfig ? (
 <Button asChild variant="outline">
 <a href="/api/health" target="_blank" rel="noreferrer">
 Ver /api/health
 </a>
 </Button>
 ) : null}
 </div>

 {error.digest ? (
 <p className="mt-4 text-caption text-[color:var(--text-muted)]">ref: {error.digest}</p>
 ) : null}
 </div>
 );
}

function buildAdminHint(msg: string): string {
 const lower = msg.toLowerCase();
 if (
 lower.includes("environment variable not found: database_url") ||
 (lower.includes("database_url") && !lower.includes("can't reach"))
 ) {
 return "DATABASE_URL não está definido neste deployment. Se o projeto usa a Vercel Supabase Integration, copie o valor de POSTGRES_PRISMA_URL para DATABASE_URL (e POSTGRES_URL_NON_POOLING para DIRECT_URL). Senão, use o pooler do Supabase (porta 6543, pgbouncer=true&connection_limit=1). Após editar, faça Redeploy sem cache.";
 }
 if (lower.includes("can't reach database server") || lower.includes("connect econnrefused")) {
 return "Postgres inacessível. Verifique se DATABASE_URL aponta para o Supabase pooler e se a senha não foi rotacionada.";
 }
 if (lower.includes("prismaclientinitializationerror")) {
 return "Prisma não conseguiu inicializar. Geralmente isso significa DATABASE_URL ausente ou inválido. Após corrigir na Vercel, é obrigatório fazer Redeploy.";
 }
 if (lower.includes("redis")) {
 return "Redis indisponível. Para o primeiro teste, defina REDIS_REQUIRED=false em Production e Redeploy. Em produção definitiva use rediss:// (TLS) — não a URL REST https:// da Upstash.";
 }
 return "Variável de ambiente obrigatória faltando. Cheque /api/health para ver qual componente está down e siga a hint correspondente.";
}
