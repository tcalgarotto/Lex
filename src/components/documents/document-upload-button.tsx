"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lexGlassCtaClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";
import { useWorkspaceStorageQuota } from "@/hooks/use-workspace-storage-quota";
import { formatBytesHumanIec } from "@/lib/storage/storage-quota";
import { parseUploadErrorResponseText } from "@/lib/storage/upload-error-message";

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
  /** Estilo do CTA em vidro (igual a «Novo caso» em Casos). */
  ctaGlass?: boolean;
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
  ctaGlass = false,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { quota, loading: quotaLoading, refresh: refreshQuota } = useWorkspaceStorageQuota();

  const quotaBlocked = quota !== null && quota.percentUsed >= 100;
  const quotaLabel =
    quota !== null
      ? `Seu plano inclui ${formatBytesHumanIec(BigInt(quota.quotaBytes))} de armazenamento.`
      : null;

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
        throw new Error(parseUploadErrorResponseText(t));
      }
      const data = (await res.json()) as UploadResult;
      onUploaded?.(data);
      void refreshQuota();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      {quotaLabel ? (
        <p className="max-w-sm text-right text-caption leading-snug text-[color:var(--text-muted)]">{quotaLabel}</p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
      />
      <Button
        type="button"
        size={ctaGlass ? "default" : size}
        variant={ctaGlass ? "secondary" : variant}
        disabled={busy || quotaLoading || quotaBlocked}
        className={cn(ctaGlass && lexGlassCtaClassName)}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <Upload className="mr-1 size-3" />
        )}
        {busy ? "Enviando…" : quotaBlocked ? "Limite atingido" : label}
      </Button>
      {error ? (
        <p className="max-w-xs text-right text-sm text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
