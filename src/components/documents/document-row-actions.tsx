"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, RefreshCcw, Unlink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface CaseRef {
  id: string;
  title: string;
}

interface Props {
  documentId: string;
  processId: string | null;
  caseId: string | null;
  cases: CaseRef[];
}

export function DocumentRowActions({ documentId, processId, caseId, cases }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reprocess() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/reprocess`, { method: "POST" });
      if (!res.ok) throw new Error(`status=${res.status}`);
      router.refresh();
    } catch (e) {
      setError(`Reprocessar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function linkTo(targetCaseId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/link-case`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: targetCaseId }),
      });
      if (!res.ok) throw new Error(`status=${res.status}`);
      router.refresh();
    } catch (e) {
      setError(`Vincular: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-1">
      {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
      {processId ? (
        <Button asChild variant="ghost" size="sm" title="Abrir documento">
          <Link href={`/processos/${processId}/documentos/${documentId}`}>
            <ExternalLink className="size-3" />
          </Link>
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={reprocess}
        title="Reprocessar"
      >
        <RefreshCcw className="size-3" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={busy} title="Vincular a caso">
            <Link2 className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-xs">
          <DropdownMenuLabel className="text-xs">Vincular a caso</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {cases.length === 0 ? (
            <DropdownMenuItem disabled>Nenhum caso ainda</DropdownMenuItem>
          ) : (
            cases.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => linkTo(c.id)}
                disabled={c.id === caseId}
                className="text-xs"
              >
                {c.title}
                {c.id === caseId ? " (atual)" : ""}
              </DropdownMenuItem>
            ))
          )}
          {caseId ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => linkTo(null)} className="text-xs">
                <Unlink className="mr-1 size-3" /> Remover do caso atual
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
