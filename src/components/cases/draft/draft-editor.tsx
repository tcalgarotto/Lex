/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DraftToolbar } from "@/components/cases/draft/draft-toolbar";

type Props = {
 value: string;
 onChange: (next: string) => void;
};

export function DraftEditor({ value, onChange }: Props) {
 const ref = useRef<HTMLTextAreaElement>(null);

 return (
 <div className="rounded-lg border border-border bg-card shadow-sm">
 <DraftToolbar textareaRef={ref} value={value} onChange={onChange} />
 <div className="grid max-h-[min(70vh,720px)] grid-cols-1 gap-0 lg:grid-cols-2">
 <ScrollArea className="h-[min(70vh,720px)] border-b border-border lg:border-b-0 lg:border-r">
 <textarea
 ref={ref}
 className="min-h-[min(70vh,720px)] w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
 spellCheck
 value={value}
 onChange={(e) => onChange(e.target.value)}
 aria-label="Editor da minuta em Markdown"
 />
 </ScrollArea>
 <ScrollArea className="h-[min(70vh,720px)] bg-muted/20">
 <div className="prose prose-sm dark:prose-invert max-w-none p-4">
 <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "_Pré-visualização vazia._"}</ReactMarkdown>
 </div>
 </ScrollArea>
 </div>
 </div>
 );
}
