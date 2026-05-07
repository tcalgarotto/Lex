"use client";

/**
 * Global error boundary — usado quando o root layout falha.
 *
 * Em produção, a causa mais comum de cair aqui é configuração ausente:
 * DATABASE_URL faltando, Prisma não inicializando, NEXT_PUBLIC_SUPABASE_URL vazio.
 * A mensagem padrão do Next ("Algo saiu do esperado") esconde isso, então
 * destacamos o problema real e apontamos /api/health como diagnóstico.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = error.message ?? "";
  const lower = msg.toLowerCase();
  const isConfig =
    /environment variable not found/i.test(msg) ||
    /database_url/i.test(lower) ||
    /prismaclientinitializationerror/i.test(lower) ||
    /can't reach database server/i.test(lower);

  const title = isConfig ? "Configuração de produção incompleta" : "Algo saiu do esperado";
  const body = isConfig
    ? "Esta instância está sem variáveis de ambiente obrigatórias (provavelmente DATABASE_URL). Um administrador precisa configurar e fazer Redeploy."
    : msg || "Erro inesperado.";

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-center text-sm text-zinc-400">{body}</p>

        {isConfig ? (
          <div className="mt-4 max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center text-xs text-amber-200">
            <p>
              Confira <code className="font-mono">/api/health</code> para ver qual componente está
              <em> down</em> e a hint correspondente.
            </p>
            <p className="mt-2 text-amber-200/70">
              Após corrigir env vars na Vercel, o Redeploy é obrigatório para aplicar.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Tentar novamente
          </button>
          {isConfig ? (
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
            >
              Ver /api/health
            </a>
          ) : null}
        </div>

        {error.digest ? (
          <p className="mt-4 text-[11px] text-zinc-600">ref: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
