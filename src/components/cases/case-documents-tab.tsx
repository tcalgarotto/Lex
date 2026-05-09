"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, RefreshCcw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deriveDocumentDisplayStatus,
  type DocumentDisplayKind,
} from "@/lib/documents/status-display";
import type { DocumentStatus } from "@prisma/client";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";

export interface CaseDocSummary {
  id: string;
  originalName: string;
  status: DocumentStatus;
  updatedAt: string | Date;
  totalChunks: number | null;
  processedChunks: number | null;
  processId: string | null;
  caseId: string | null;
}

interface Props {
  caseId: string;
  documents: CaseDocSummary[];
}

export function CaseDocumentsTab({ caseId, documents }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reprocess(id: string) {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/documents/${id}/reprocess`, { method: "POST" });
      if (!res.ok) throw new Error(`status=${res.status}`);
      router.refresh();
    } catch (e) {
      setError(`Falha ao reprocessar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function unlink(id: string) {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/documents/${id}/link-case`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: null }),
      });
      if (!res.ok) throw new Error(`status=${res.status}`);
      router.refresh();
    } catch (e) {
      setError(`Falha ao desvincular: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="Nenhum documento neste caso"
        description="Envie uma petição, despacho, contrato ou prova — ou vincule um documento que já está no escritório."
        secondaryAction={{
          label: "Vincular existente",
          href: "/documentos?unlinked=1",
          variant: "outline",
        }}
      >
        <div className="mt-4 flex justify-center">
          <DocumentUploadButton caseId={caseId} label="Enviar documento para este caso" />
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Card className="border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
          {error}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/documentos?unlinked=1`}>Vincular existente</Link>
        </Button>
        <DocumentUploadButton caseId={caseId} label="Enviar documento para este caso" />
      </div>

      <ul className="space-y-2">
        {documents.map((d) => {
          const status = deriveDocumentDisplayStatus({
            status: d.status,
            updatedAt: d.updatedAt,
          });
          return (
            <li key={d.id}>
              <Card className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.originalName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <StatusChip kind={status.kind} label={status.label} />
                      {d.totalChunks !== null ? (
                        <span>
                          {d.processedChunks ?? 0}/{d.totalChunks} trechos
                        </span>
                      ) : null}
                      <span>
                        Atualizado {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {d.processId ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/processos/${d.processId}/documentos/${d.id}`}>
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === d.id}
                      onClick={() => reprocess(d.id)}
                      title="Reprocessar"
                    >
                      <RefreshCcw className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === d.id}
                      onClick={() => unlink(d.id)}
                      title="Desvincular do caso"
                    >
                      <Unlink className="size-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const KIND_TONE: Record<DocumentDisplayKind, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  progress: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

function StatusChip({ kind, label }: { kind: DocumentDisplayKind; label: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${KIND_TONE[kind]}`}>
      {label}
    </Badge>
  );
}
