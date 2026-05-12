"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "loading" | "ready" | "error";

export function BibliotecaPdfCover({
  documentId,
  label,
  className,
  thumbnailVersion,
}: {
  documentId: string;
  label: string;
  className?: string;
  /** Query `v=` na rota de miniatura para bust de cache após alteração do documento. */
  thumbnailVersion?: number;
}) {
  const [phase, setPhase] = useState<Phase>("loading");

  const onLoad = useCallback(() => setPhase("ready"), []);
  const onError = useCallback(() => setPhase("error"), []);

  const thumbQuery =
    typeof thumbnailVersion === "number" && Number.isFinite(thumbnailVersion)
      ? `?v=${thumbnailVersion}`
      : "";

  if (phase === "error") {
    return (
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-violet-600/35 via-sky-600/25 to-indigo-700/35 px-1 text-white/90",
          className,
        )}
        role="img"
        aria-label={label ? `Pré-visualização indisponível para ${label}` : "Pré-visualização indisponível"}
      >
        <FileText className="size-8 opacity-80" aria-hidden />
        <span className="max-w-[95%] text-center text-[9px] font-semibold uppercase leading-tight tracking-wide opacity-95">
          Prévia indisponível
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative size-full overflow-hidden bg-[color:var(--surface-overlay-strong)]", className)}>
      {phase === "loading" ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-[color:var(--surface-overlay)]/90 text-[color:var(--text-muted)]"
          aria-hidden
        >
          <span className="inline-block size-6 animate-pulse rounded-md bg-[color:var(--surface-overlay-strong)]" />
          <span className="max-w-[90%] text-center text-[9px] font-medium uppercase tracking-wide">
            Carregando prévia…
          </span>
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- rota API autenticada; sem otimização estática */}
      <img
        src={`/api/documents/${documentId}/thumbnail${thumbQuery}`}
        alt={label ? `Pré-visualização de ${label}` : "Primeira página do PDF"}
        className={cn(
          "size-full object-cover object-center object-top lex-transition",
          phase === "ready" ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}
