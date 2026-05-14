"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "progressive" | "error";

/** Prévia rápida na variante `full` (API `w=` opcional 40–240). */
const FULL_PREVIEW_MAX_W = 120;
/**
 * Lista: 1.º pedido no mínimo da API (`w=40`) para menos bytes e encode mais rápido;
 * 2.º `w=240`. Não é “instantâneo” se o servidor ainda tiver de gerar a miniatura a partir do PDF.
 */
const LIST_LQIP_MAX_W = 40;
const LIST_HQ_MAX_W = 240;

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
 * - `list`: `w=40` (1.º frame) → `w=240`; LQIP fica `opacity-0` até `onLoad` (spinner só até lá).
 * - `full`: prévia `w=120` → ficheiro completo do storage; prévia invisível até `onLoad`.
 */
export function DocumentPdfThumbnail({
  documentId,
  label,
  className,
  thumbnailVersion,
  variant = "list",
  lqipLoading = "lazy",
}: {
  documentId: string;
  label: string;
  className?: string;
  /** Query `v=` na rota de miniatura para bust de cache após alteração do documento. */
  thumbnailVersion?: number;
  variant?: "list" | "full";
  /**
   * Só na variante `list`: `eager` pede o LQIP de imediato (útil nos primeiros cards visíveis).
   * `lazy` evita centenas de pedidos paralelos em listas longas.
   */
  lqipLoading?: "eager" | "lazy";
}) {
  const [phase, setPhase] = useState<Phase>("progressive");
  const [listLqipPainted, setListLqipPainted] = useState(false);
  const [listHqPainted, setListHqPainted] = useState(false);
  const [listHqFailed, setListHqFailed] = useState(false);
  const [previewPainted, setPreviewPainted] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const [loadFull, setLoadFull] = useState(false);

  const { previewQuery, fullQuery, listLqipQuery, listHqQuery } = useMemo(() => {
    const baseV =
      typeof thumbnailVersion === "number" && Number.isFinite(thumbnailVersion)
        ? thumbnailVersion
        : undefined;
    return {
      previewQuery: buildThumbSearchParams(baseV, FULL_PREVIEW_MAX_W),
      fullQuery: buildThumbSearchParams(baseV),
      listLqipQuery: buildThumbSearchParams(baseV, LIST_LQIP_MAX_W),
      listHqQuery: buildThumbSearchParams(baseV, LIST_HQ_MAX_W),
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
        <span className="max-w-[95%] text-center text-micro font-semibold uppercase leading-tight tracking-wide opacity-95">
          Prévia indisponível
        </span>
      </div>
    );
  }

  if (variant === "list") {
    const showListSpinner = !listLqipPainted;

    return (
      <div
        className={cn("relative size-full overflow-hidden bg-[color:var(--surface-overlay-strong)]", className)}
        role="img"
        aria-label={label ? `Pré-visualização de ${label}` : "Primeira página do PDF"}
      >
        {showListSpinner ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--surface-overlay-strong)]"
            aria-hidden
          >
            <Loader2 className="size-7 animate-spin text-[color:var(--text-muted)]" aria-hidden />
          </div>
        ) : null}

        {/* LQIP (`w=` baixo): invisível até `onLoad` — o spinner some quando a 1.ª miniatura está pronta. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- rota API autenticada */}
        <img
          src={`/api/documents/${documentId}/thumbnail${listLqipQuery}`}
          alt=""
          className={cn(
            "absolute inset-0 z-0 size-full object-cover object-top transition-opacity duration-200 ease-out",
            !listLqipPainted && "opacity-0",
            listLqipPainted && (!listHqPainted || listHqFailed) && "opacity-100",
            listLqipPainted && listHqPainted && !listHqFailed && "pointer-events-none opacity-0",
          )}
          loading={lqipLoading}
          decoding="async"
          fetchPriority={lqipLoading === "eager" ? "high" : "low"}
          onLoad={() => setListLqipPainted(true)}
          onError={() => setPhase("error")}
        />

        {listLqipPainted && !listHqFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- rota API autenticada
          <img
            src={`/api/documents/${documentId}/thumbnail${listHqQuery}`}
            alt=""
            className={cn(
              "absolute inset-0 z-[1] size-full object-cover object-top transition-opacity duration-300 ease-out",
              listHqPainted ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            onLoad={() => setListHqPainted(true)}
            onError={() => setListHqFailed(true)}
          />
        ) : null}
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
            previewPainted ? (fullReady ? "pointer-events-none opacity-0" : "opacity-100") : "opacity-0",
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
