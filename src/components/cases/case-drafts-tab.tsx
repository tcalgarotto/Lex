"use client";

/**
 * F5 — Draft Workspace.
 *
 * Substituiu o `<pre>` cru por um workspace de duas colunas:
 *  - esquerda: Preview (react-markdown) | Editar (textarea com salvar).
 *  - direita: painel "Fontes Usadas" (groundingChunkIds) e "Lacunas"
 *    (extraídas de metadataJson.lacunas / unindexedFoundations).
 *
 * Edição cria nova versão (PATCH /api/cases/[id]/drafts/[draftId]).
 * Sem export DOCX/PDF aqui — fica para P+1, conforme plano.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Loader2,
  Pencil,
  Eye,
  Save,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileDown,
} from "lucide-react";
import type { CaseDraft } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { caseDraftStatusLabel } from "@/lib/cases/labels";

interface Props {
  caseId: string;
  drafts: CaseDraft[];
}

type ViewMode = "preview" | "edit";

type DraftMeta = {
  lacunas?: string[];
  unindexedFoundations?: Array<{ urn?: string; label: string; suggestedUse?: string }>;
  sections?: Array<{ id: string; title: string; chars: number }>;
  usedBrainContext?: boolean;
  usedPinnedSources?: number;
  brainVersion?: number | null;
  editedFromVersion?: number;
  editedAt?: string;
};

function readMeta(json: unknown): DraftMeta {
  if (!json || typeof json !== "object") return {};
  return json as DraftMeta;
}

export function CaseDraftsTab({ caseId, drafts }: Props) {
  const router = useRouter();
  const [openVersion, setOpenVersion] = useState<number | null>(drafts[0]?.version ?? null);
  const [view, setView] = useState<ViewMode>("preview");
  const [editorValue, setEditorValue] = useState<string>(drafts[0]?.content ?? "");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [copied, setCopied] = useState(false);

  if (!drafts.length) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Nenhuma peça gerada ainda. Use o botão{" "}
        <span className="font-semibold text-foreground">Gerar peça</span> no topo do caso.
      </Card>
    );
  }

  const current = drafts.find((d) => d.version === openVersion) ?? drafts[0]!;
  const meta = readMeta(current.metadataJson);

  function selectVersion(v: number) {
    setOpenVersion(v);
    const next = drafts.find((d) => d.version === v) ?? drafts[0]!;
    setEditorValue(next.content);
    setView("preview");
    setSavedNote(null);
    setError(null);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  }

  function download(format: "docx" | "pdf" | "md") {
    const url = `/api/cases/${caseId}/drafts/${current.id}/export?format=${format}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSave() {
    setError(null);
    setSavedNote(null);
    if (editorValue === current.content) {
      setSavedNote("Sem alterações para salvar.");
      return;
    }
    startSaving(async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/drafts/${current.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: editorValue }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `HTTP ${res.status}`);
        }
        setSavedNote("Nova versão salva.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {drafts.map((d) => {
          const dMeta = readMeta(d.metadataJson);
          return (
            <Button
              key={d.id}
              variant={d.version === current.version ? "default" : "outline"}
              size="sm"
              onClick={() => selectVersion(d.version)}
              className="text-xs"
            >
              v{d.version} · {caseDraftStatusLabel(d.status)}
              {dMeta.editedFromVersion ? (
                <span className="ml-1 opacity-70">(de v{dMeta.editedFromVersion})</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <header className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              v{current.version}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {caseDraftStatusLabel(current.status)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {current.groundingChunkIds.length} fundamentos
            </Badge>
            {meta.usedBrainContext ? (
              <Badge variant="outline" className="text-[10px] text-violet-300">
                Contexto do caso aplicado
              </Badge>
            ) : null}
            {meta.usedPinnedSources && meta.usedPinnedSources > 0 ? (
              <Badge variant="outline" className="text-[10px] text-emerald-300">
                {meta.usedPinnedSources} salvo(s) no caso
              </Badge>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {new Date(current.createdAt).toLocaleString("pt-BR")}
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                variant={view === "preview" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("preview")}
                className="h-7 px-2 text-xs"
              >
                <Eye className="mr-1 size-3" /> Preview
              </Button>
              <Button
                variant={view === "edit" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setEditorValue(current.content);
                  setView("edit");
                }}
                className="h-7 px-2 text-xs"
              >
                <Pencil className="mr-1 size-3" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1 size-3 text-emerald-400" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 size-3" /> Copiar
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => download("docx")}
                className="h-7 px-2 text-xs"
                title="Baixar DOCX"
              >
                <FileDown className="mr-1 size-3" /> DOCX
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => download("pdf")}
                className="h-7 px-2 text-xs"
                title="Baixar PDF"
              >
                <FileDown className="mr-1 size-3" /> PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => download("md")}
                className="h-7 px-2 text-xs"
                title="Baixar Markdown"
              >
                <FileDown className="mr-1 size-3" /> MD
              </Button>
            </div>
          </header>

          {view === "preview" ? (
            <article className="prose prose-invert prose-sm max-w-none p-4 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.content}</ReactMarkdown>
            </article>
          ) : (
            <div className="space-y-2 p-3">
              <Textarea
                value={editorValue}
                onChange={(e) => setEditorValue(e.target.value)}
                className="min-h-[420px] font-mono text-[12px] leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || editorValue === current.content}
                >
                  {isSaving ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 size-3" />
                  )}
                  Salvar como nova versão
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditorValue(current.content);
                    setSavedNote(null);
                    setError(null);
                  }}
                >
                  Descartar alterações
                </Button>
                {savedNote ? (
                  <span className="text-[11px] text-emerald-300">{savedNote}</span>
                ) : null}
                {error ? (
                  <span className="text-[11px] text-red-300">{error}</span>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        <SidePanel current={current} meta={meta} />
      </div>
    </div>
  );
}

function SidePanel({ current, meta }: { current: CaseDraft; meta: DraftMeta }) {
  const lacunas = meta.lacunas ?? [];
  const unindexed = meta.unindexedFoundations ?? [];
  const sections = useMemo(() => meta.sections ?? [], [meta.sections]);

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <BookOpen className="size-3" /> Fontes usadas ({current.groundingChunkIds.length})
        </h4>
        {current.groundingChunkIds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nenhum fundamento consultado nesta versão.
          </p>
        ) : (
          <ul className="space-y-1 text-[11px] text-foreground/80">
            {current.groundingChunkIds.slice(0, 8).map((id) => (
              <li key={id}>
                Fonte {id.slice(0, 8)}…
              </li>
            ))}
            {current.groundingChunkIds.length > 8 ? (
              <li className="text-[11px] text-muted-foreground">
                +{current.groundingChunkIds.length - 8} fontes adicionais
              </li>
            ) : null}
          </ul>
        )}
      </Card>

      {lacunas.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-3">
          <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
            <AlertTriangle className="size-3" /> Lacunas ({lacunas.length})
          </h4>
          <ul className="space-y-1 text-[11px] text-amber-100/90">
            {lacunas.map((l, i) => (
              <li key={i} className="leading-snug">
                — {l}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {unindexed.length > 0 ? (
        <Card className="border-violet-500/30 bg-violet-500/5 p-3">
          <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-violet-200">
            <BookOpen className="size-3" /> Fundamentos a complementar ({unindexed.length})
          </h4>
          <ul className="space-y-1 text-[11px] text-violet-100/90">
            {unindexed.map((u, i) => (
              <li key={i} className="leading-snug">
                <span className="font-semibold">{u.label}</span>
                {u.suggestedUse ? <span> — {u.suggestedUse}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-violet-200/70">
            Estas normas ainda não estão indexadas no corpus. Revise antes de protocolar.
          </p>
        </Card>
      ) : null}

      {sections.length > 0 ? (
        <Card className="p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Seções ({sections.length})
          </h4>
          <ul className="space-y-0.5 text-[11px] text-foreground/80">
            {sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.title}</span>
                <span className="text-[10px] text-muted-foreground">{s.chars} c.</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
