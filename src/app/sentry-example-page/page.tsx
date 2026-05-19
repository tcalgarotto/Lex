"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

/**
 * Página de verificação do Sentry — remover ou restringir após validar em staging.
 */
export default function SentryExamplePage() {
  const dsnConfigured = Boolean(process.env["NEXT_PUBLIC_SENTRY_DSN"]?.trim());

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Verificação Sentry</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Org: <strong>lotys</strong> · Projeto: <strong>lex</strong>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          DSN:{" "}
          {dsnConfigured ? (
            <span className="text-emerald-600">configurado</span>
          ) : (
            <span className="text-amber-600">
              ausente — defina <code className="font-mono text-xs">NEXT_PUBLIC_SENTRY_DSN</code>
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          onClick={() => {
            throw new Error("Sentry Test Error — Lex verification");
          }}
        >
          Disparar erro de teste
        </button>
        <button
          type="button"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          onClick={() => {
            Sentry.captureMessage("Sentry test message — Lex verification", "info");
          }}
        >
          Enviar mensagem de teste
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Confira em{" "}
        <a
          href="https://sentry.io/organizations/lotys/issues/"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Sentry Issues (lotys)
        </a>
        . Erros do console do DevTools não são capturados.
      </p>

      <Link href="/" className="text-sm text-violet-500 hover:underline">
        ← Voltar
      </Link>
    </main>
  );
}
