"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadResult {
  documentId: string;
  status: string;
  caseId?: string | null;
}

interface Props {
  /**
   * Quando preenchido, o documento é vinculado a este caso já no upload
   * (antes do pipeline de ingestão rodar).
   */
  caseId?: string;
  /**
   * Idem para vincular a um Process legado.
   */
  processId?: string;
  /**
   * Texto do botão. Default: "Enviar documento".
   */
  label?: string;
  /** Tamanho do botão. */
  size?: "sm" | "default";
  /** Variante do botão. */
  variant?: "default" | "secondary" | "outline" | "ghost";
  /** Estilo customizado. */
  className?: string;
  /** Tipos aceitos no input file (override). */
  accept?: string;
  /** Callback após upload bem-sucedido. */
  onUploaded?: (result: UploadResult) => void;
}

const DEFAULT_ACCEPT = ".pdf,.docx,.doc,.txt,application/pdf";

/**
 * Botão genérico de envio de documento. POSTa para
 * `/api/documents/upload` via `multipart/form-data`. Quando recebe `caseId`
 * ou `processId`, repassa no form para que o backend já vincule o
 * documento ao caso/processo.
 */
export function DocumentUploadButton({
  caseId,
  processId,
  label = "Enviar documento",
  size = "sm",
  variant = "default",
  className,
  accept = DEFAULT_ACCEPT,
  onUploaded,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (caseId) fd.append("caseId", caseId);
      if (processId) fd.append("processId", processId);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as UploadResult;
      onUploaded?.(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
      />
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <Upload className="mr-1 size-3" />
        )}
        {busy ? "Enviando…" : label}
      </Button>
      {error ? (
        <p className="max-w-xs text-right text-[11px] text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
