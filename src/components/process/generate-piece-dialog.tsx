"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const KINDS = [
  "manifestação",
  "réplica",
  "contestação",
  "agravo",
  "apelação",
  "embargos",
  "parecer",
  "contrato",
] as const;

export function GeneratePieceDialog(props: { processId: string }) {
  const { processId } = props;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("manifestação");
  const [objective, setObjective] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [pieceId, setPieceId] = useState<string | null>(null);

  const canSubmit = useMemo(() => objective.trim().length >= 6 && !loading, [objective, loading]);

  async function submit() {
    setLoading(true);
    setPieceId(null);
    try {
      const res = await fetch("/api/pieces/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          kind,
          objective,
          title: title.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { pieceId: string };
      setPieceId(data.pieceId);
      toast.success("Peça gerada. Abrindo editor…");
      setOpen(false);
      window.location.href = `/editor/${data.pieceId}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar peça");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <Sparkles className="mr-2 size-4" />
          Gerar peça
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar peça</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Tipo</p>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={k === kind ? "default" : "outline"}
                  onClick={() => setKind(k)}
                >
                  {k}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Objetivo (obrigatório)</p>
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex.: manifestar sobre despacho de emenda à inicial, reforçando ausência de documentos e pedindo prazo adicional."
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Título (opcional)</p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ex.: ${kind} — despacho de emenda`}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Gerar e abrir
            </Button>
          </div>

          {pieceId ? (
            <p className="text-xs text-muted-foreground">
              Se não abrir automaticamente:{" "}
              <Link className="text-violet-400 hover:underline" href={`/editor/${pieceId}`}>
                abrir no editor
              </Link>
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

