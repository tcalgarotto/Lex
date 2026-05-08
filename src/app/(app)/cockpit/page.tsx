"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Plug,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import type {
  CaseAlert,
  CaseAlertSeverity,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  Notification as DbNotification,
} from "@prisma/client";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type AlertsResp = { alerts: CaseAlert[] };
type IntegResp = { integrations: Integration[] };
type NotifResp = { notifications: DbNotification[]; unread: number };
type ChecklistItem = {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
};
type ChecklistResp = { items: ChecklistItem[] };

const SEVERITY_TONE: Record<CaseAlertSeverity, string> = {
  CRITICAL: "border-rose-500/50 bg-rose-500/10 text-rose-200",
  HIGH: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  MEDIUM: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  LOW: "border-indigo-400/40 bg-indigo-400/10 text-indigo-200",
  INFO: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

const STATUS_TONE: Record<IntegrationStatus, string> = {
  CONNECTED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  DISCONNECTED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  ERROR: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  PAUSED: "border-amber-400/40 bg-amber-400/10 text-amber-200",
};

const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  PJE: "PJe",
  ESAJ: "e-SAJ",
  PROJUDI: "Projudi",
  EPROC: "EPROC",
  DIARIO_OFICIAL: "Diário Oficial",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  CALENDAR: "Calendário",
  WEBHOOK: "Webhook",
};

export default function CockpitPage() {
  const [alerts, setAlerts] = useState<CaseAlert[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, i, n, c] = await Promise.all([
        fetch("/api/alerts?status=OPEN,ACKED&take=50").then((r) => r.json() as Promise<AlertsResp>),
        fetch("/api/integrations").then((r) => r.json() as Promise<IntegResp>),
        fetch("/api/notifications?take=50").then((r) => r.json() as Promise<NotifResp>),
        fetch("/api/cockpit/checklist").then((r) => r.json() as Promise<ChecklistResp>),
      ]);
      setAlerts(a.alerts ?? []);
      setIntegrations(i.integrations ?? []);
      setNotifications(n.notifications ?? []);
      setUnread(n.unread ?? 0);
      setChecklist(c.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/integrations/sync", { method: "POST" });
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const ack = useCallback(
    async (id: string, action: "ack" | "dismiss" | "resolve") => {
      await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await refresh();
    },
    [refresh],
  );

  const noIntegrations = integrations.length === 0;

  return (
    <AppShell title="Cockpit operacional">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock className="size-3.5" /> Cockpit operacional do escritório
            </div>
            <h1 className="text-2xl font-semibold">Cockpit operacional</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Monitora saúde do sistema, jobs IA, documentos, corpus, feedback e
              alertas internos. Integrações externas (PJe, e-SAJ, Projudi, EPROC,
              Diário Oficial, e-mail, WhatsApp, calendário) aparecerão aqui quando
              forem configuradas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              data-testid="cockpit-refresh"
            >
              {loading ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <RefreshCcw className="mr-2 size-3.5" />}
              Atualizar
            </Button>
            <Button
              onClick={sync}
              disabled={syncing || noIntegrations}
              data-testid="cockpit-sync"
              title={
                noIntegrations
                  ? "Nenhuma integração externa configurada"
                  : undefined
              }
            >
              {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plug className="mr-2 size-4" />}
              Rodar sync agora
            </Button>
          </div>
        </header>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        {checklist.length > 0 ? (
          <section
            className="rounded-xl border border-white/10 bg-zinc-950/40 p-4"
            data-testid="cockpit-checklist"
          >
            <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
              Checklist do MVP
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-md border border-white/5 bg-zinc-900/30 px-3 py-2"
                >
                  {item.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    {item.hint && !item.ok ? (
                      <p className="mt-0.5 text-[11px] text-amber-200/80">{item.hint}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            icon={<AlertTriangle className="size-4" />}
            label="Alertas abertos"
            value={alerts.filter((a) => a.status === "OPEN").length}
          />
          <KpiCard
            icon={<Plug className="size-4" />}
            label="Integrações conectadas"
            value={integrations.filter((i) => i.status === "CONNECTED").length}
            total={integrations.length}
          />
          <KpiCard
            icon={<Bell className="size-4" />}
            label="Notificações não lidas"
            value={unread}
          />
        </div>

        <Tabs defaultValue="alerts">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-4 space-y-2">
            {alerts.length === 0 ? (
              <EmptyHint label="Sem alertas no momento. Tudo monitorado." />
            ) : (
              alerts.map((a) => (
                <article
                  key={a.id}
                  className={`rounded-lg border p-3 ${SEVERITY_TONE[a.severity]}`}
                  data-testid="cockpit-alert"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{a.kind}</Badge>
                      <Badge variant="secondary">{a.severity}</Badge>
                      <span className="font-mono text-[10px] opacity-70">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.status === "OPEN" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => ack(a.id, "ack")}
                        >
                          Confirmar
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => ack(a.id, "dismiss")}
                      >
                        Dispensar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => ack(a.id, "resolve")}
                      >
                        Resolver
                      </Button>
                    </div>
                  </header>
                  <h3 className="mt-2 text-sm font-medium text-foreground">{a.title}</h3>
                  <p className="mt-1 text-xs opacity-90">{a.message}</p>
                  {a.reference ? (
                    <p className="mt-2 font-mono text-[10px] opacity-70">{a.reference}</p>
                  ) : null}
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="integrations" className="mt-4 space-y-2">
            {integrations.length === 0 ? (
              <EmptyHint label="Nenhuma integração externa configurada. Quando você conectar PJe / e-SAJ / Projudi / EPROC / Diário / e-mail / WhatsApp / calendário, elas aparecem aqui." />
            ) : (
              integrations.map((i) => (
                <article
                  key={i.id}
                  className={`rounded-lg border p-3 ${STATUS_TONE[i.status]}`}
                  data-testid="cockpit-integration"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{PROVIDER_LABEL[i.provider]}</Badge>
                      <Badge variant="secondary">{i.status}</Badge>
                      {i.lastSyncedAt ? (
                        <span className="font-mono text-[10px] opacity-70">
                          últ. sync {new Date(i.lastSyncedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    {i.status === "CONNECTED" ? (
                      <CheckCircle2 className="size-4 opacity-70" />
                    ) : i.status === "ERROR" ? (
                      <AlertTriangle className="size-4 opacity-70" />
                    ) : null}
                  </header>
                  <h3 className="mt-2 text-sm font-medium text-foreground">{i.label}</h3>
                  {i.lastError ? (
                    <p className="mt-1 text-xs opacity-80">{i.lastError}</p>
                  ) : null}
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="notifications" className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <EmptyHint label="Caixa vazia." />
            ) : (
              notifications.map((n) => (
                <article
                  key={n.id}
                  className="rounded-lg border border-white/10 bg-zinc-950/40 p-3"
                  data-testid="cockpit-notification"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{n.kind}</Badge>
                    {n.status === "UNREAD" ? <Badge variant="secondary">não lida</Badge> : null}
                    <span className="font-mono text-[10px] opacity-70">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium text-foreground">{n.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                  {n.href ? (
                    <a
                      href={n.href}
                      className="mt-1 inline-flex text-[11px] text-indigo-300 hover:underline"
                    >
                      Abrir →
                    </a>
                  ) : null}
                </article>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  total,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-foreground">
        {value}
        {typeof total === "number" ? <span className="text-sm opacity-50">/{total}</span> : null}
      </div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-white/10 bg-zinc-950/30 p-6 text-center text-xs text-muted-foreground">
      {label}
    </p>
  );
}
