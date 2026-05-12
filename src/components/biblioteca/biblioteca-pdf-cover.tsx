"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function BibliotecaPdfCover({
  documentId,
  label,
  className,
}: {
  documentId: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-violet-600/35 via-sky-600/25 to-indigo-700/35 text-white/90",
          className,
        )}
        aria-hidden
      >
        <FileText className="size-8 opacity-80" />
        <span className="max-w-[90%] truncate px-1 text-center text-[10px] font-semibold uppercase tracking-wide opacity-90">
          PDF
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- rota API autenticada; sem otimização estática
    <img
      src={`/api/documents/${documentId}/thumbnail`}
      alt={label ? `Pré-visualização de ${label}` : "Primeira página do PDF"}
      className={cn(
        "size-full object-cover object-center object-top",
        className,
      )}
      loading="lazy"
      onError={onError}
    />
  );
}
