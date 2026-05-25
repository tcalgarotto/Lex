"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const QUICK_TEMPLATES = [
  "Olá! Recebemos sua mensagem e retornaremos em breve.",
  "Poderia enviar os documentos solicitados?",
  "Confirmamos sua reunião. Qualquer dúvida, estamos à disposição.",
];

type ConversationRow = {
  id: string;
  unreadCount: number;
  lastMessageAt: string | null;
  caseId: string | null;
  contact: {
    id: string;
    displayName: string;
    phoneE164: string | null;
    pipelineStage: string;
    optOutWhatsapp?: boolean;
    caseId: string | null;
  };
  messages?: { body: string; direction: string; sentAt: string }[];
};

type MessageRow = {
  id: string;
  direction: string;
  body: string;
  sentAt: string;
  deliveryStatus: string | null;
  mediaJson?: unknown;
};

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

export function CrmInboxClient() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [caseLinkId, setCaseLinkId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const inboxQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (filterUnread) p.set("unread", "1");
    if (searchQ.trim()) p.set("q", searchQ.trim());
    const qs = p.toString();
    return `/api/crm/inbox${qs ? `?${qs}` : ""}`;
  }, [filterUnread, searchQ]);

  const loadInbox = useCallback(async () => {
    const res = await fetch(inboxQuery());
    const data = (await res.json()) as {
      conversations?: ConversationRow[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Falha ao carregar inbox");
    setConversations(data.conversations ?? []);
  }, [inboxQuery]);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/crm/conversations/${id}/messages`);
    const data = (await res.json()) as { messages?: MessageRow[] };
    setMessages((data.messages ?? []).slice().reverse());
    await fetch(`/api/crm/conversations/${id}/mark-read`, { method: "POST" });
  }, []);

  const loadSidebar = useCallback(async (contactId: string) => {
    const res = await fetch(`/api/crm/contacts/${contactId}/activities`);
    if (res.ok) {
      const data = (await res.json()) as { activities?: ActivityRow[] };
      setActivities(data.activities ?? []);
    }
  }, []);

  useEffect(() => {
    loadInbox()
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [loadInbox]);

  useEffect(() => {
    const t = setInterval(() => {
      loadInbox().catch(() => {});
      if (selectedId) loadMessages(selectedId).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [loadInbox, loadMessages, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId).catch(() => {});
    const c = conversations.find((x) => x.id === selectedId);
    if (c?.contact.id) loadSidebar(c.contact.id).catch(() => {});
  }, [selectedId, loadMessages, loadSidebar, conversations]);

  async function sendReply() {
    if (!selectedId || !composer.trim()) return;
    const sel = conversations.find((c) => c.id === selectedId);
    if (sel?.contact.optOutWhatsapp) {
      setError("Contato com opt-out de WhatsApp — envio bloqueado.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: composer.trim(), direction: "OUTBOUND" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar");
      setComposer("");
      await loadMessages(selectedId);
      await loadInbox();
      if (sel?.contact.id) await loadSidebar(sel.contact.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function linkCase() {
    if (!selectedId || !caseLinkId.trim()) return;
    const res = await fetch(`/api/crm/conversations/${selectedId}/link-case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: caseLinkId.trim() }),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Falha ao vincular caso");
      return;
    }
    await loadInbox();
    setCaseLinkId("");
  }

  async function createFollowUp() {
    const sel = conversations.find((c) => c.id === selectedId);
    if (!sel || !newTaskTitle.trim()) return;
    const res = await fetch(`/api/crm/contacts/${sel.contact.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "FOLLOW_UP",
        title: newTaskTitle.trim(),
        conversationId: selectedId,
      }),
    });
    if (!res.ok) {
      setError("Falha ao criar follow-up");
      return;
    }
    setNewTaskTitle("");
    await loadSidebar(sel.contact.id);
  }

  const selected = conversations.find((c) => c.id === selectedId);
  const lastPreview = selected?.messages?.[0];

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando inbox…</p>;
  }

  return (
    <div className="relative flex h-[calc(100vh-12rem)] min-h-[400px] gap-0 overflow-hidden rounded-lg border">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/30">
        <div className="space-y-2 border-b p-2">
          <Input
            placeholder="Buscar nome, telefone…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadInbox()}
          />
          <Button
            type="button"
            variant={filterUnread ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={() => {
              setFilterUnread((v) => !v);
              setTimeout(() => void loadInbox(), 0);
            }}
          >
            {filterUnread ? "Só não lidas" : "Todas"}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm hover:bg-muted/60",
                  selectedId === c.id && "bg-muted",
                )}
              >
                <span className="font-medium">{c.contact.displayName}</span>
                {lastPreview && selectedId === c.id ? (
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {lastPreview.body}
                  </span>
                ) : null}
                {c.unreadCount > 0 ? (
                  <span className="text-xs text-primary">{c.unreadCount} não lidas</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <header className="border-b px-4 py-2">
              <h2 className="font-medium">{selected.contact.displayName}</h2>
              <p className="text-xs text-muted-foreground">
                {selected.contact.phoneE164 ?? "—"} · {selected.contact.pipelineStage}
                {selected.contact.optOutWhatsapp ? " · opt-out" : ""}
              </p>
            </header>
            <div className="flex flex-wrap gap-1 border-b px-2 py-1">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t.slice(0, 20)}
                  type="button"
                  className="rounded bg-muted px-2 py-0.5 text-[10px] hover:bg-muted/80"
                  onClick={() => setComposer(t)}
                >
                  Template
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.direction === "OUTBOUND"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {m.mediaJson ? (
                    <p className="italic opacity-80">Mídia recebida</p>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  )}
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(m.sentAt).toLocaleString("pt-BR")} ·{" "}
                    {m.deliveryStatus ?? m.direction}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t p-3">
              <textarea
                className="min-h-[2.5rem] flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Responder… (Enter envia, Shift+Enter quebra linha)"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
              />
              <Button onClick={() => void sendReply()} disabled={sending}>
                {sending ? "…" : "Enviar"}
              </Button>
            </div>
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa
          </p>
        )}
      </section>

      <aside className="hidden w-64 shrink-0 overflow-y-auto border-l bg-muted/20 p-3 lg:block">
        {selected ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Contato</p>
              <Link href={`/crm/contacts?id=${selected.contact.id}`} className="text-primary hover:underline">
                {selected.contact.displayName}
              </Link>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Caso vinculado</p>
              <p className="text-xs">{selected.caseId ?? selected.contact.caseId ?? "—"}</p>
              <div className="mt-1 flex gap-1">
                <Input
                  placeholder="ID do caso"
                  value={caseLinkId}
                  onChange={(e) => setCaseLinkId(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => void linkCase()}>
                  Vincular
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Follow-up</p>
              <div className="flex gap-1">
                <Input
                  placeholder="Nova tarefa"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" onClick={() => void createFollowUp()}>
                  +
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Histórico</p>
              <ul className="space-y-1 text-xs">
                {activities.slice(0, 8).map((a) => (
                  <li key={a.id} className="border-b pb-1">
                    <span className="font-medium">{a.title}</span>
                    <br />
                    <span className="text-muted-foreground">{a.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Detalhes da conversa</p>
        )}
      </aside>

      {error ? (
        <p className="absolute bottom-4 left-4 max-w-md rounded bg-destructive/10 px-2 py-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
