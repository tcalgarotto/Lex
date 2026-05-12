"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "progressive" | "error";

/** Prévia rápida na variante `full` (API aceita 48–240). */
const FULL_PREVIEW_MAX_W = 120;
/**
 * Listagens: um só pedido com a maior largura que a API permite em `w=`
 * (nitidez nos cards sem segundo fetch ao storage).
 */
const LIST_THUMB_MAX_W = 240;

function buildThumbSearchParams(thumbnailVersion?: number, previewWidth?: number): string {
  const p = new URLSearchParams();
  if (typeof thumbnailVersion === "number" && Number.isFinite(thumbnailVersion)) {
    p.set("v", String(thumbnailVersion));
  }
  if (typeof previewWidth === "number") {
    p.set("w", String(previewWidth));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Miniatura PDF via rota API autenticada.
 * - `list` (default): um pedido com `w=240` (melhor qualidade possível num único encode).
 * - `full`: prévia `w=120` → ficheiro completo do storage, com crossfade.
 */
export function DocumentPdfThumbnail({
  documentId,
  label,
  className,
  thumbnailVersion,
  variant = "list",
}: {
  documentId: string;
  label: string;
  className?: string;
  /** Query `v=` na rota de miniatura para bust de cache após alteração do documento. */
  thumbnailVersion?: number;
  variant?: "list" | "full";
}) {
  const [phase, setPhase] = useState<Phase>("progressive");
  const [listReady, setListReady] = useState(false);
  const [previewPainted, setPreviewPainted] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const [loadFull, setLoadFull] = useState(false);

  const { previewQuery, fullQuery, listSingleQuery } = useMemo(() => {
    const baseV =
      typeof thumbnailVersion === "number" && Number.isFinite(thumbnailVersion)
        ? thumbnailVersion
        : undefined;
    return {
      previewQuery: buildThumbSearchParams(baseV, FULL_PREVIEW_MAX_W),
      fullQuery: buildThumbSearchParams(baseV),
      listSingleQuery: buildThumbSearchParams(baseV, LIST_THUMB_MAX_W),
    };
  }, [thumbnailVersion]);

  const onPreviewLoad = useCallback(() => {
    setPreviewPainted(true);
    if (variant === "full") setLoadFull(true);
  }, [variant]);

  const onPreviewError = useCallback(() => {
    setPreviewFailed(true);
    if (variant === "full") setLoadFull(true);
  }, [variant]);

  const onFullError = useCallback(() => setPhase("error"), []);

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

  if (variant === "list") {
    return (
      <div
        className={cn("relative size-full overflow-hidden bg-[color:var(--surface-overlay-strong)]", className)}
        role="img"
        aria-label={label ? `Pré-visualização de ${label}` : "Primeira página do PDF"}
      >
        {!listReady ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--surface-overlay-strong)]"
            aria-hidden
          >
            <Loader2 className="size-7 animate-spin text-[color:var(--text-muted)]" aria-hidden />
          </div>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element -- rota API autenticada */}
        <img
          src={`/api/documents/${documentId}/thumbnail${listSingleQuery}`}
          alt=""
          className="absolute inset-0 size-full object-cover object-top opacity-100"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setListReady(true)}
          onError={() => setPhase("error")}
        />
      </div>
    );
  }

  const showSkeleton = !previewPainted && !previewFailed;

  return (
    <div
      className={cn("relative size-full overflow-hidden bg-[color:var(--surface-overlay-strong)]", className)}
      role="img"
      aria-label={label ? `Pré-visualização de ${label}` : "Primeira página do PDF"}
    >
      {showSkeleton ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-[color:var(--surface-overlay-strong)]"
          aria-hidden
        >
          <Loader2 className="size-8 animate-spin text-[color:var(--text-muted)]" aria-hidden />
        </div>
      ) : null}

      {!previewFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- rota API autenticada
        <img
          src={`/api/documents/${documentId}/thumbnail${previewQuery}`}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 z-0 size-full object-cover object-top transition-opacity duration-500 ease-out",
            fullReady ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          onLoad={onPreviewLoad}
          onError={onPreviewError}
        />
      ) : null}

      {loadFull ? (
        // eslint-disable-next-line @next/next/no-img-element -- rota API autenticada; qualidade final
        <img
          src={`/api/documents/${documentId}/thumbnail${fullQuery}`}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 z-[1] size-full object-cover object-top transition-opacity duration-500 ease-out",
            fullReady ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setFullReady(true)}
          onError={onFullError}
        />
      ) : null}
    </div>
  );
}
