"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <h2 className="text-lg font-semibold">Algo saiu do esperado</h2>
        <p className="mt-2 max-w-md text-center text-sm text-zinc-400">{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
