/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 *
 * Toolbar Markdown: insere sintaxe no trecho selecionado (armazenamento = texto Markdown no banco).
 * TipTap está nas dependências do projeto; esta aba prioriza Markdown puro para coincidir com `CaseDraft.content`.
 */

"use client";

import type { RefObject } from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function wrapSelection(
  value: string,
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
): { next: string; caret: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const caret = start + before.length + selected.length + after.length;
  return { next, caret };
}

function insertLinePrefix(value: string, textarea: HTMLTextAreaElement, prefix: string): { next: string; caret: number } {
  const pos = textarea.selectionStart;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = value.indexOf("\n", pos);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const line = value.slice(lineStart, end);
  const stripped = line.replace(/^#{1,3}\s+/, "");
  const nextLine = `${prefix}${stripped}`;
  const next = value.slice(0, lineStart) + nextLine + value.slice(end);
  const caret = lineStart + nextLine.length;
  return { next, caret };
}

type Props = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
};

export function DraftToolbar({ textareaRef, value, onChange }: Props) {
  function apply(mutate: (v: string, el: HTMLTextAreaElement) => { next: string; caret: number }) {
    const el = textareaRef.current;
    if (!el) return;
    const { next, caret } = mutate(value, el);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Negrito"
        onClick={() =>
          apply((v, el) => wrapSelection(v, el, "**", "**"))
        }
      >
        <Bold className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Itálico"
        onClick={() =>
          apply((v, el) => wrapSelection(v, el, "_", "_"))
        }
      >
        <Italic className="size-4" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Título nível 1"
        onClick={() => apply((v, el) => insertLinePrefix(v, el, "# "))}
      >
        <Heading1 className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Título nível 2"
        onClick={() => apply((v, el) => insertLinePrefix(v, el, "## "))}
      >
        <Heading2 className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Título nível 3"
        onClick={() => apply((v, el) => insertLinePrefix(v, el, "### "))}
      >
        <Heading3 className="size-4" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Lista"
        onClick={() =>
          apply((v, el) => {
            const start = el.selectionStart;
            const lineStart = v.lastIndexOf("\n", start - 1) + 1;
            return { next: `${v.slice(0, lineStart)}- ${v.slice(lineStart)}`, caret: lineStart + 2 };
          })
        }
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Citação"
        onClick={() =>
          apply((v, el) => {
            const { next, caret } = wrapSelection(v, el, "\n> ", "\n");
            return { next, caret };
          })
        }
      >
        <Quote className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Link"
        onClick={() =>
          apply((v, el) => wrapSelection(v, el, "[", "](https://)"))
        }
      >
        <Link2 className="size-4" />
      </Button>
    </div>
  );
}
