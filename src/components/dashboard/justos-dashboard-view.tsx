import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  FileText,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverPrefetchLink } from "@/components/navigation/hover-prefetch-link";
import type { DashboardViewModel } from "@/lib/dashboard/dashboard-service";
import { DashboardKanbanBoardLazy } from "@/components/dashboard/dashboard-kanban-lazy";
import { DashboardCalendarCards } from "@/components/calendar/dashboard-calendar-cards";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatTodayPt(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function JustosDashboardView({
  vm,
  workspaceId,
}: {
  vm: DashboardViewModel;
  workspaceId: string;
}) {
  const honorific = vm.honorific === "Dra." ? "Dra." : "Dr.";

  return (
    <div className="justos-dashboard" data-testid="justos-dashboard">
      <header className="flex flex-col gap-4 border-b border-[color:var(--border-subtle)] pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[color:var(--text-secondary)]">
            {formatTodayPt()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[1.75rem]">
            {salutation()}, {honorific} {vm.displayName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)]">
            Cockpit operacional — prioridades, quadro de casos e prazos do escritório.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-10" asChild>
            <Link href="/cases/new">
              <Plus className="mr-1.5 size-4" aria-hidden />
              Novo caso
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-10" asChild>
            <Link href="/editor">
              <FileText className="mr-1.5 size-4" aria-hidden />
              Criar peça
            </Link>
          </Button>
          <Button
            size="sm"
            className="h-10 border border-[color:var(--brand-border)] text-[color:var(--text-inverse)]"
            style={{ background: "var(--brand-primary)" }}
            asChild
          >
            <Link href="/agenda">Nova tarefa</Link>
          </Button>
        </div>
      </header>

      {vm.urgent ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3"
          role="status"
        >
          <AlertTriangle className="size-4 shrink-0 text-red-400" aria-hidden />
          <div className="min-w-0 flex-1 text-sm text-[color:var(--text-primary)]">
            <span className="font-medium text-red-300">{vm.urgent.title}</span>
            <span className="text-[color:var(--text-secondary)]"> — {vm.urgent.message}</span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" asChild>
            <HoverPrefetchLink href={vm.urgent.href}>{vm.urgent.ctaLabel}</HoverPrefetchLink>
          </Button>
        </div>
      ) : null}

      <section aria-label="Métricas do escritório">
        <div className="justos-dashboard__metrics">
          {vm.metrics.map((m) => (
            <div key={m.id} className="justos-dashboard__metric-card">
              <p className="justos-dashboard__metric-value">{m.value}</p>
              <p className="justos-dashboard__metric-label">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="justos-dashboard__main-grid">
        <div className="flex min-w-0 flex-col gap-[var(--dashboard-content-gap)]">
          <section className="justos-dashboard__panel" aria-labelledby="now-heading">
            <div className="justos-dashboard__panel-head">
              <div>
                <h2 id="now-heading" className="justos-dashboard__section-title">
                  O que fazer agora
                </h2>
                <p className="justos-dashboard__section-lead">
                  Ações priorizadas com base nos casos e pendências do workspace.
                </p>
              </div>
            </div>
            {vm.nowActions.length === 0 ? (
              <p className="justos-dashboard__empty">
                {vm.hasNoCases
                  ? "Crie o primeiro caso para ver prioridades aqui."
                  : "Nenhuma ação urgente no momento."}
              </p>
            ) : (
              <ul>
                {vm.nowActions.map((item) => (
                  <li key={item.id} className="justos-dashboard__now-row">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{item.reason}</p>
                    </div>
                    <Button size="sm" className="shrink-0" asChild>
                      <HoverPrefetchLink href={item.href}>{item.cta}</HoverPrefetchLink>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {vm.nowActionsOverflow > 0 ? (
              <p className="border-t border-[color:var(--border-subtle)] px-4 py-2 text-xs text-[color:var(--text-muted)]">
                +{vm.nowActionsOverflow} outras ações na fila
              </p>
            ) : null}
          </section>

          <section className="justos-dashboard__panel" aria-labelledby="board-heading">
            <div className="justos-dashboard__panel-head">
              <div>
                <h2 id="board-heading" className="justos-dashboard__section-title">
                  Quadro de casos
                </h2>
                <p className="justos-dashboard__section-lead">
                  Arraste cards entre colunas ou use o menu &quot;Mover para&quot; em cada card.
                </p>
              </div>
            </div>
            {vm.hasNoCases ? (
              <div className="justos-dashboard__empty">
                <p>Sem casos ativos.</p>
                <Button className="mt-3" asChild>
                  <Link href="/cases/new">Criar primeiro caso</Link>
                </Button>
              </div>
            ) : (
              <DashboardKanbanBoardLazy initialByColumn={vm.kanbanByColumn} />
            )}
          </section>

          <section className="justos-dashboard__panel" aria-labelledby="activity-heading">
            <div className="justos-dashboard__panel-head">
              <h2 id="activity-heading" className="justos-dashboard__section-title">
                Atividade recente
              </h2>
            </div>
            {vm.activities.length === 0 ? (
              <p className="justos-dashboard__empty">Nenhuma movimentação nas últimas horas.</p>
            ) : (
              <ul className="justos-dashboard__activity-list">
                {vm.activities.map((ev) => (
                  <li key={ev.id} className="justos-dashboard__activity-item">
                    <p className="text-sm text-[color:var(--text-primary)]">{ev.line}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">{ev.timeLabel}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <DashboardCalendarCards workspaceId={workspaceId} />
        </div>

        <aside className="flex min-w-0 flex-col gap-[var(--dashboard-content-gap)]">
          <section
            className={cn(
              "rounded-2xl border border-violet-500/20 bg-[color-mix(in_srgb,var(--brand-primary)_6%,transparent)] p-4",
            )}
            aria-labelledby="copilot-heading"
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-violet-300" aria-hidden />
              <h2 id="copilot-heading" className="text-sm font-semibold text-[color:var(--text-primary)]">
                {vm.copilotTitle}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">{vm.copilotMessage}</p>
          </section>

          <section className="justos-dashboard__panel" aria-labelledby="quick-heading">
            <div className="justos-dashboard__panel-head">
              <h2 id="quick-heading" className="justos-dashboard__section-title">
                Ações rápidas
              </h2>
            </div>
            <div className="justos-dashboard__quick-grid">
              <QuickLink href="/cases/new" icon={Plus} label="Novo caso" />
              <QuickLink href="/documentos" icon={Upload} label="Upload" />
              <QuickLink href="/pesquisa-juridica" icon={Search} label="Pesquisa JustOS" />
              <QuickLink href="/editor" icon={FileText} label="Criar peça" />
              <QuickLink href="/crm" icon={LayoutGrid} label="CRM Pro" />
              <QuickLink href="/agenda" icon={Calendar} label="Agenda" />
            </div>
          </section>

          <section className="justos-dashboard__panel" aria-labelledby="consult-heading">
            <div className="justos-dashboard__panel-head">
              <h2 id="consult-heading" className="justos-dashboard__section-title">
                Consultar
              </h2>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/cases">
                  <Briefcase className="mr-2 size-4" aria-hidden />
                  Casos
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/processos">Processos judiciais</Link>
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Button variant="outline" className="h-auto min-h-[44px] flex-col gap-1 py-3 text-center text-sm" asChild>
      <Link href={href}>
        <Icon className="size-5 opacity-90" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
