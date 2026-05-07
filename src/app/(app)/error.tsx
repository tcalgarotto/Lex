"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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

  const isAuth = /not authenticated|n\u00e3o autenticado|unauthorized/i.test(error.message);
  const isNetwork = /failed to fetch|networkerror|fetch failed/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-lg font-semibold text-zinc-100">
        {isAuth
          ? "Sua sessão expirou"
          : isNetwork
            ? "Falha de rede"
            : "Algo saiu do esperado"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        {isAuth
          ? "Faça login novamente para continuar."
          : isNetwork
            ? "Não conseguimos falar com o servidor. Verifique sua conexão e tente outra vez."
            : error.message || "Erro inesperado."}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => reset()} variant="default">
          Tentar novamente
        </Button>
        {isAuth ? (
          <Button asChild variant="outline">
            <a href="/login">Fazer login</a>
          </Button>
        ) : null}
      </div>
      {error.digest ? (
        <p className="mt-4 text-[11px] text-zinc-600">ref: {error.digest}</p>
      ) : null}
    </div>
  );
}
