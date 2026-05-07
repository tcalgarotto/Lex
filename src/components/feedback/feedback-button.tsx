"use client";

import { useState } from "react";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FeedbackButton(props: { processId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [highlight, setHighlight] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
          difficulty,
          highlight,
          processId: props.processId ?? null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Feedback recebido. Obrigado!");
      setOpen(false);
      setComment("");
      setDifficulty("");
      setHighlight("");
      setRating(5);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-zinc-200">
          <MessageSquarePlus className="size-4" />
          Enviar feedback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Feedback rápido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nota (1–5)</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={n === rating ? "default" : "outline"}
                  onClick={() => setRating(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="highlight">O mais impressionante (opcional)</Label>
            <Input id="highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="Ex.: fontes e confiança" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="difficulty">Dificuldade encontrada (opcional)</Label>
            <Input id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Ex.: upload, entender as fontes..." />
          </div>

          <div className="space-y-1">
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="O que melhorar primeiro para o seu uso real?" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

