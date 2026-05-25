"use client";

import { useChat } from "@ai-sdk/react";
import type { JSONValue, Message, UIMessage } from "@ai-sdk/ui-utils";
import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Citation = {
 ref: number;
 label?: string;
 type?: string;
 section?: string | null;
 excerpt?: string;
 score?: number | null;
 href?: string | null;
};

function messageAnnotations(m: Message | UIMessage): JSONValue[] | undefined {
  const legacy = (m as Message).annotations;
  if (Array.isArray(legacy)) return legacy;
  const meta = (m as { metadata?: { annotations?: JSONValue[] } }).metadata;
  if (meta && Array.isArray(meta.annotations)) return meta.annotations;
  return undefined;
}

function getCitationsFromMessage(m: Message | UIMessage): Citation[] {
  const anns = messageAnnotations(m) ?? [];
 for (const a of anns) {
 if (!a || typeof a !== "object") continue;
 const obj = a as Record<string, unknown>;
 if (obj["type"] !== "citations") continue;
 const cits = obj["citations"];
 if (Array.isArray(cits)) return cits as Citation[];
 // server messages API wraps citationsJson as { citations: <array> }
 if (cits && typeof cits === "object") {
 const wrap = cits as Record<string, unknown>;
 const inner = wrap["citations"];
 if (Array.isArray(inner)) return inner as Citation[];
 }
 }
 return [];
}

function getConfidenceFromMessage(m: Message | UIMessage): string | null {
  const anns = messageAnnotations(m) ?? [];
 for (const a of anns) {
 if (!a || typeof a !== "object") continue;
 const obj = a as Record<string, unknown>;
 if (obj["type"] !== "confidence") continue;
 if (typeof obj["label"] === "string") return obj["label"];
 }
 return null;
}

function getConfidenceJustification(m: Message | UIMessage): string | null {
  const anns = messageAnnotations(m) ?? [];
 for (const a of anns) {
 if (!a || typeof a !== "object") continue;
 const obj = a as Record<string, unknown>;
 if (obj["type"] !== "confidence") continue;
 if (typeof obj["justification"] === "string") return obj["justification"];
 }
 return null;
}

function getBaseInsufficient(m: Message | UIMessage): { level?: string; reasons?: string[]; warnings?: string[] } | null {
  const anns = messageAnnotations(m) ?? [];
 for (const a of anns) {
 if (!a || typeof a !== "object") continue;
 const obj = a as Record<string, unknown>;
 if (obj["type"] !== "source_sufficiency") continue;
 if (obj["sufficient"] === false) {
 return {
 level: typeof obj["level"] === "string" ? obj["level"] : undefined,
 reasons: Array.isArray(obj["reasons"]) ? (obj["reasons"] as string[]) : undefined,
 warnings: Array.isArray(obj["warnings"]) ? (obj["warnings"] as string[]) : undefined,
 };
 }
 }
 return null;
}

export function ProcessChat({
 threadId,
 initialMessages,
}: {
 threadId: string;
 initialMessages?: Message[];
}) {
 const sp = useSearchParams();
 const initialQ = useMemo(() => sp.get("q") ?? "", [sp]);
 const { messages, input, setInput, handleSubmit, isLoading, error } = useChat({
 api: `/api/chat/${threadId}`,
 initialMessages,
 });
 const bottom = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (initialQ && !input) setInput(initialQ);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [initialQ]);

 useEffect(() => {
 bottom.current?.scrollIntoView({ behavior: "smooth" });
 }, [messages]);

 return (
 <div className="lex-glass-card flex h-[520px] flex-col rounded-2xl">
 <ScrollArea className="flex-1 p-4">
 <div className="space-y-4">
 {messages.length === 0 ? (
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 text-sm text-muted-foreground">
 <p className="font-medium text-[color:var(--text-primary)]">Inicie a análise contextual</p>
 <p className="mt-1">
 Pergunte algo sobre o processo. O JustOS vai recuperar fontes, calcular confiança jurídica e responder com guardrails quando a base for insuficiente.
 </p>
 <p className="mt-2 text-xs">
 Sugestão: <span className="text-[color:var(--text-primary)]">“O que devo fazer diante deste despacho?”</span>
 </p>
 </div>
 ) : null}
 {messages.map((m) => (
 <div
 key={m.id}
 className={cn("rounded-lg px-3 py-2 text-sm",
 m.role === "user"
 ? "ml-8 bg-violet-600/15 text-[color:var(--text-primary)]"
 : "mr-8 border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-primary)]",
 )}
 >
 {m.role === "assistant" ? (
 <div className="prose prose-invert max-w-none prose-p:my-2 prose-headings:my-2">
 <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
 </div>
 ) : (
 <p className="whitespace-pre-wrap">{m.content}</p>
 )}
 {m.role === "assistant" ? (
 (() => {
 const cits = getCitationsFromMessage(m);
 const conf = getConfidenceFromMessage(m);
 const confJust = getConfidenceJustification(m);
 const insuff = getBaseInsufficient(m);
 if (!cits.length && !conf && !insuff) return null;
 return (
 <div className="mt-3 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-2">
 <div className="mb-1 flex items-center justify-between gap-2">
 <p className="text-[11px] font-medium uppercase text-muted-foreground">
 Fontes usadas pela IA
 </p>
 <div className="flex items-center gap-2">
 {insuff ? (
 <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
 Base insuficiente para conclusão segura
 </span>
 ) : null}
 {conf ? (
 <span className="text-[11px] text-muted-foreground">
 confiança jurídica: <span className="text-[color:var(--text-primary)]">{conf}</span>
 </span>
 ) : null}
 </div>
 </div>
 {confJust ? (
 <p className="mb-2 text-[11px] text-muted-foreground">{confJust}</p>
 ) : null}
 {insuff?.reasons?.length ? (
 <ul className="mb-2 list-inside list-disc text-[11px] text-amber-200/90">
 {insuff.reasons.slice(0, 3).map((r) => (
 <li key={r}>{r}</li>
 ))}
 </ul>
 ) : null}
 {cits.length ? (
 <ol className="space-y-1 text-[11px] text-[color:var(--text-secondary)]">
 {cits.map((c) => (
 <li key={String(c.ref)} className="leading-relaxed">
 <span className="text-muted-foreground">[{String(c.ref)}]</span>{" "}
 <span className="text-[color:var(--text-primary)]">{String(c.label ?? "Fonte")}</span>
 {c.type ? (
 <span className="text-muted-foreground"> · {String(c.type)}</span>
 ) : null}
 {c.section ? (
 <span className="text-muted-foreground"> · seção: {String(c.section)}</span>
 ) : null}
 {typeof c.score === "number" ? (
 <span className="text-muted-foreground"> · score {c.score.toFixed(3)}</span>
 ) : null}
 {c.excerpt ? (
 <span className="text-muted-foreground">
 {" "}
 — “{String(c.excerpt).slice(0, 180)}”
 </span>
 ) : null}
 {c.href ? (
 <a
 className="ml-2 text-violet-300 hover:underline"
 href={String(c.href)}
 target="_blank"
 rel="noreferrer"
 >
 abrir
 </a>
 ) : null}
 </li>
 ))}
 </ol>
 ) : (
 <p className="text-[11px] text-muted-foreground">Nenhuma fonte recuperada.</p>
 )}
 </div>
 );
 })()
 ) : null}
 </div>
 ))}
 {isLoading ? (
 <p className="text-xs text-muted-foreground">
 Consolidando contexto processual… buscando fontes… fundamentando com cautela…
 </p>
 ) : null}
 {error ? (
 <p className="text-xs text-red-400">{error.message}</p>
 ) : null}
 <div ref={bottom} />
 </div>
 </ScrollArea>
 <form
 onSubmit={handleSubmit}
 className="flex gap-2 border-t border-[color:var(--border-default)] p-3"
 >
 <Textarea
 value={input}
 onChange={(e) => setInput(e.target.value)}
 placeholder="Pergunte com contexto do processo…"
 className="min-h-[44px] flex-1 resize-none"
 rows={2}
 />
 <Button type="submit" disabled={isLoading || !input.trim()}>
 Enviar
 </Button>
 </form>
 </div>
 );
}
