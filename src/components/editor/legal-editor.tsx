"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type JSONContent = Record<string, unknown>;

export function LegalEditor(props: {
  pieceId: string;
  initialContent: JSONContent;
  processId: string | null;
  aiMeta?: Record<string, unknown> | null;
}) {
  const { pieceId, initialContent, processId, aiMeta } = props;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Escreva sua peça… Selecione texto e use os botões de IA." }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert max-w-none min-h-[400px] focus:outline-none px-4 py-3",
        ),
      },
    },
  });

  const runAi = useCallback(
    async (action: "continue" | "fundamentar" | "jurisprudencia" | "estilo") => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, "\n");
      if (!text.trim()) {
        toast.error("Selecione um trecho.");
        return;
      }
      const res = await fetch("/api/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, selection: text, processId }),
      });
      if (!res.ok) {
        toast.error("Falha na IA");
        return;
      }
      const acc = await res.text();
      editor.chain().focus().insertContent(`\n\n${acc}\n\n`).run();
      toast.success("Inserido.");
    },
    [editor, processId],
  );

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const json = editor.getJSON();
      const flat = JSON.stringify(json);
      const refs = [...flat.matchAll(/\[fonte:(\d+)\]/g)].map((m) => m[1] ?? "");
      setCitations([...new Set(refs)]);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const save = async () => {
      setSaveState("saving");
      const json = editor.getJSON();
      try {
        const res = await fetch(`/api/pieces/${pieceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentJson: json }),
        });
        if (!res.ok) throw new Error(await res.text());
        setSaveState("saved");
        setSavedAt(new Date());
      } catch {
        setSaveState("error");
        toast.error("Autosave falhou");
      }
    };
    const sub = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(save, 1200);
    };
    editor.on("update", sub);
    return () => {
      editor.off("update", sub);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editor, pieceId]);

  if (!editor) return <p className="text-sm text-muted-foreground">Carregando editor…</p>;

  const confidence =
    aiMeta && typeof aiMeta === "object"
      ? (aiMeta["confidence"] as Record<string, unknown> | undefined)
      : undefined;
  const suff =
    aiMeta && typeof aiMeta === "object"
      ? (aiMeta["sourceSufficiency"] as Record<string, unknown> | undefined)
      : undefined;
  const citationsMeta =
    aiMeta && typeof aiMeta === "object" ? (aiMeta["citations"] as unknown) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="rounded-xl border border-white/10 bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-2">
          <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => void runAi("continue")}>
            Continuar
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void runAi("fundamentar")}>
            Fundamentar
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void runAi("jurisprudencia")}>
            Jurisprudência
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void runAi("estilo")}>
            Meu estilo
          </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {saveState === "saving"
                ? "Salvando…"
                : saveState === "error"
                  ? "Erro ao salvar"
                  : savedAt
                    ? `Salvo ${savedAt.toISOString().slice(11, 19)}`
                    : "Salvo"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/pieces/${pieceId}/export?format=docx`, "_blank")}
            >
              Exportar DOCX
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/pieces/${pieceId}/export?format=pdf`, "_blank")}
            >
              Exportar PDF
            </Button>
          </div>
        </div>
        <EditorContent editor={editor} />
      </div>
      <ScrollArea className="h-[560px] rounded-xl border border-white/10 bg-zinc-900/30 p-3">
        <div className="mb-4 rounded-lg border border-white/10 bg-zinc-950/40 p-3">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Confiabilidade</p>
          {confidence && typeof confidence === "object" ? (
            <div className="space-y-1 text-xs">
              <p>
                <span className="text-muted-foreground">Confiança:</span>{" "}
                <span className="text-zinc-100">{String(confidence["label"] ?? "—")}</span>
                {typeof confidence["score"] === "number" ? (
                  <span className="text-muted-foreground"> ({(confidence["score"] as number).toFixed(3)})</span>
                ) : null}
              </p>
              {typeof confidence["justification"] === "string" ? (
                <p className="text-muted-foreground">{confidence["justification"]}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem metadados de geração.</p>
          )}

          {suff && typeof suff === "object" && suff["sufficient"] === false ? (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
              <p className="font-medium">Base insuficiente para conclusão segura</p>
              {Array.isArray(suff["reasons"]) ? (
                <ul className="mt-1 list-inside list-disc">
                  {(suff["reasons"] as string[]).slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Citações detectadas</p>
        {citations.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma [fonte:N] ainda.</p>
        ) : (
          <ul className="space-y-1 text-xs text-violet-300">
            {citations.map((c) => (
              <li key={c}>[fonte:{c}]</li>
            ))}
          </ul>
        )}

        {Array.isArray(citationsMeta) ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Fontes usadas na geração</p>
            <ul className="space-y-1 text-xs text-zinc-300">
              {(citationsMeta as Array<Record<string, unknown>>).slice(0, 12).map((c, idx) => (
                <li key={String(c["ref"] ?? idx)} className="leading-relaxed">
                  <span className="text-muted-foreground">[{String(c["ref"] ?? idx + 1)}]</span>{" "}
                  {String(c["label"] ?? "Fonte")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
