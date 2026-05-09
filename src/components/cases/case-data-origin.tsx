"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseMetadataJson } from "@/lib/cases/data-origin-meta";

type Kind = "fact" | "request" | "risk" | "legalSource";

export function CaseDataOriginButton(props: {
  kind: Kind;
  metadataJson: unknown;
  confidence?: number | null;
  createdAt: Date | string;
  actorUserId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const meta = parseMetadataJson(props.metadataJson);
  const conf =
    typeof meta.confidence === "number"
      ? meta.confidence
      : typeof props.confidence === "number"
        ? props.confidence
        : null;
  const updated =
    meta.lastEditedAt ??
    (typeof props.createdAt === "string" ? props.createdAt : props.createdAt.toISOString());
  const actor = meta.lastEditedById ?? props.actorUserId ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
        >
          <Info className="size-3" />
          Origem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Origem dos dados</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2 text-xs text-muted-foreground">
          <div>
            <dt className="text-[10px] uppercase tracking-wide">Tipo</dt>
            <dd className="text-foreground">{labelKind(props.kind)}</dd>
          </div>
          {meta.origin ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide">Origem declarada</dt>
              <dd className="text-foreground">{meta.origin}</dd>
            </div>
          ) : null}
          {meta.source ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide">Fonte / modo</dt>
              <dd className="text-foreground">{meta.source}</dd>
            </div>
          ) : null}
          {meta.status ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide">Status</dt>
              <dd className="text-foreground">{meta.status}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[10px] uppercase tracking-wide">Confiança</dt>
            <dd className="text-foreground">
              {conf !== null && conf !== undefined ? `${Math.round(conf * 100)}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide">Última referência</dt>
            <dd className="text-foreground">{formatPt(updated)}</dd>
          </div>
          {actor ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide">Responsável (id)</dt>
              <dd className="break-all font-mono text-[10px] text-foreground">{actor}</dd>
            </div>
          ) : null}
          {meta.sourceText ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide">Trecho de origem</dt>
              <dd className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-zinc-950/60 p-2 text-[11px] text-foreground">
                {meta.sourceText}
              </dd>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Sem trecho literal em metadados — exibindo apenas o texto consolidado na lista.
            </p>
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function labelKind(k: Kind): string {
  switch (k) {
    case "fact":
      return "Fato";
    case "request":
      return "Pedido";
    case "risk":
      return "Risco";
    case "legalSource":
      return "Fundamento fixado";
    default:
      return k;
  }
}

function formatPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
