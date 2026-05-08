"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Fallback de segurança para `/biblioteca`. A página principal hoje só faz
 * `redirect("/pesquisa-juridica?scope=legislacao")`, mas mantemos um error
 * boundary para nunca cair com Server Components error em edge cases.
 */
export default function BibliotecaError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-lg font-semibold">Não foi possível abrir a biblioteca</h2>
      <p className="text-sm text-muted-foreground">
        A biblioteca jurídica agora vive dentro de Pesquisa jurídica. Use o botão abaixo para
        ir até lá.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="default">
          <Link href="/pesquisa-juridica?scope=legislacao">Abrir Pesquisa jurídica</Link>
        </Button>
        <Button variant="ghost" onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
