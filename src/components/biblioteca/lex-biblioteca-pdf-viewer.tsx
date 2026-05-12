"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** URL da API (ex.: `/api/documents/…/file`) — mesmo site, cookies incluídos. */
  fileUrl: string;
  title: string;
  className?: string;
};

/**
 * Leitor PDF rápido: **iframe** com o ficheiro `inline` — o navegador usa o motor
 * nativo (ex. PDFium no Chrome), com **streaming**, sem descarregar o PDF inteiro
 * em JavaScript como o react-pdf fazia.
 */
export function LexBibliotecaPdfViewer({ fileUrl, title, className }: Props) {
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    setFrameReady(false);
    const t = window.setTimeout(() => setFrameReady(true), 10_000);
    return () => window.clearTimeout(t);
  }, [fileUrl]);

  const onFrameLoad = useCallback(() => {
    setFrameReady(true);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] shadow-inner",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/80 px-3 py-2">
        <p className="min-w-0 flex-1 text-xs leading-snug text-[color:var(--text-secondary)]">
          Leitor <strong className="text-[color:var(--text-primary)]">nativo do navegador</strong> — streaming, ideal para PDFs grandes (ex.: vade-mécum).
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 inline size-3.5 opacity-90" aria-hidden />
            Novo separador
          </a>
        </Button>
      </div>

      <div className="relative w-full overflow-hidden bg-neutral-200/40 dark:bg-neutral-950/80">
        {!frameReady ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[color:var(--surface-overlay)]/50 text-sm text-muted-foreground backdrop-blur-[1px]">
            <Loader2 className="size-6 animate-spin opacity-80" aria-hidden />
            <span>A preparar leitor…</span>
          </div>
        ) : null}
        <iframe
          title={title}
          src={fileUrl}
          allow="fullscreen"
          className="block size-full min-h-[min(78vh,900px)] w-full border-0 bg-white dark:bg-neutral-950"
          onLoad={onFrameLoad}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
