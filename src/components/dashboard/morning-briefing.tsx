import type { ComponentType, ReactNode } from "react";
import { HoverPrefetchLink } from "@/components/navigation/hover-prefetch-link";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Calendar,
  FileText,
  Library,
  Link2,
  Plus,
  Scale,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BriefingActionEisenhowerBucket,
  BriefingActionItem,
  MorningBriefingPayload,
  MorningBriefingShellProps,
  PulseCasesDetail,
  PulseDocumentsDetail,
  PulseLibraryDetail,
  PulsePiecesDetail,
  ResumeCaseRow,
  ResumeNamedCase,
} from "@/lib/dashboard/morning-briefing-data";
import { cn } from "@/lib/utils";

/** Cópia estável da home — regressão de texto e ausência de jargão de métodos (vitest). */
export const DASHBOARD_HOME_UI_COPY = {
  planejamentoSemanaTitulo: "Planejamento da semana",
  metaSecao: "Meta da semana",
  metaEmptyHonesto:
    "Defina uma meta semanal para acompanhar o avanço do escritório. Ainda não há indicadores gravados aqui — nada é estimado automaticamente.",
  tarefasAvulsasSecao: "Tarefas avulsas",
  tarefasAvulsasIntro: "Para lembretes que não vêm de caso, documento ou minuta — ligações, cobranças, reuniões internas.",
  tarefasAvulsasEmpty: "Nenhuma tarefa avulsa guardada ainda.",
  oQueFazerAgora: "O que fazer agora",
  casosPorFluxo: "Casos por fluxo",
  prioridadeMaxima: "Prioridade máxima",
  importante: "Importante",
  aguardandoTerceiros: "Aguardando terceiros",
} as const;

export const DASHBOARD_FORBIDDEN_METHOD_TERMS = [
  "Scrumban",
  "Scrum",
  "Kanban",
  "GTD",
  "Eisenhower",
  "OKR",
  "sprint",
  "backlog",
  "WIP",
] as const;

function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function ActionIcon({ type }: { type: BriefingActionItem["type"] }) {
  const cls =
    "flex size-11 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-primary)]";
  const iconCls = "size-[22px] shrink-0";
  const stroke = 2.25;
  if (type === "documento")
    return (
      <div className={cls}>
        <FileText className={iconCls} strokeWidth={stroke} aria-hidden />
      </div>
    );
  if (type === "peça")
    return (
      <div className={cls}>
        <Scale className={iconCls} strokeWidth={stroke} aria-hidden />
      </div>
    );
  if (type === "processo")
    return (
      <div className={cls}>
        <Link2 className={iconCls} strokeWidth={stroke} aria-hidden />
      </div>
    );
  if (type === "pesquisa")
    return (
      <div className={cls}>
        <Search className={iconCls} strokeWidth={stroke} aria-hidden />
      </div>
    );
  return (
    <div className={cls}>
      <Briefcase className={iconCls} strokeWidth={stroke} aria-hidden />
    </div>
  );
}

function priorityStyles(p: BriefingActionItem["priority"]): string {
  if (p === "urgent") return "bg-[rgba(220,38,38,0.1)] text-red-200";
  if (p === "low") return "bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-muted)]";
  return "bg-[rgba(124,58,237,0.1)] text-violet-200";
}

function PulseBriefCard(props: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  variant: "cases" | "documents" | "library";
  detail: PulseCasesDetail | PulseDocumentsDetail | PulseLibraryDetail;
}) {
  const { icon: Ico, label, variant, detail } = props;
  const footerHref =
    variant === "cases" ? "/cases" : variant === "documents" ? (detail as PulseDocumentsDetail).nextHref : (detail as PulseLibraryDetail).nextHref;
  const footerLabel =
    variant === "cases"
      ? "Ver casos"
      : variant === "documents"
        ? (detail as PulseDocumentsDetail).nextCtaLabel
        : (detail as PulseLibraryDetail).nextCtaLabel;

  return (
    <div className="lex-glass-card flex h-full min-h-[168px] flex-col rounded-2xl px-4 py-3 md:px-5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
        <Ico className="size-[13px] opacity-80" aria-hidden />
        {label}
      </div>
      <p className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--text-primary)]">{detail.headline}</p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[11.5px] leading-snug text-[color:var(--text-secondary)]">
        {detail.breakdownLines.map((line, i) => (
          <li key={`${i}-${line.slice(0, 24)}`}>· {line}</li>
        ))}
      </ul>
      <div className="mt-auto pt-2">
        <div className="h-px w-full shrink-0 bg-[color:var(--border-subtle)]" aria-hidden />
        <HoverPrefetchLink
          href={footerHref}
          className="mt-1.5 flex h-9 w-full items-center justify-center rounded-md border border-violet-500/15 bg-violet-500/[0.04] px-2 text-center text-[11px] font-medium text-violet-400 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
        >
          {footerLabel}
        </HoverPrefetchLink>
      </div>
    </div>
  );
}

function PulsePiecesBriefCard({ detail }: { detail: PulsePiecesDetail }) {
  return (
    <div className="lex-glass-card flex h-full min-h-[168px] flex-col rounded-2xl px-4 py-3 md:px-5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
        <Scale className="size-[13px] opacity-80" aria-hidden />
        Peças e minutas
      </div>
      <p className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--text-primary)]">{detail.headline}</p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[11.5px] leading-snug text-[color:var(--text-secondary)]">
        {detail.breakdownLines.map((line, i) => (
          <li key={`${i}-${line.slice(0, 24)}`}>· {line}</li>
        ))}
      </ul>
      {detail.emptyHint ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--text-muted)]">{detail.emptyHint}</p>
      ) : null}
      <div className="mt-auto pt-2">
        <div className="h-px w-full shrink-0 bg-[color:var(--border-subtle)]" aria-hidden />
        <HoverPrefetchLink
          href={detail.nextHref}
          className="mt-1.5 flex h-9 w-full items-center justify-center rounded-md border border-violet-500/15 bg-violet-500/[0.04] px-2 text-center text-[11px] font-medium text-violet-400 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
        >
          {detail.nextCtaLabel}
        </HoverPrefetchLink>
      </div>
    </div>
  );
}

/** Hero + CTAs + estado “sem casos” — renderização rápida sem dados pesados do briefing. */
export function MorningBriefingHeaderShell(
  props: MorningBriefingShellProps & { headerTrailing?: ReactNode },
) {
  const { displayName, hasNoCases, honorific, headerTrailing } = props;
  const dateLine = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <h1 className="sr-only">Hoje no escritório — Lex</h1>

      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="mt-1 text-xl font-medium tracking-tight text-[color:var(--text-primary)]">
              {salutation()}, {honorific}{" "}
              <span className="text-[color:var(--brand-primary)]">{displayName}</span>
            </p>
            <p className="mt-1 text-sm capitalize text-[color:var(--text-secondary)]">{dateLine}</p>
          </div>
          {headerTrailing ? (
            <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 pt-1 sm:w-auto sm:pt-0.5">{headerTrailing}</div>
          ) : null}
        </div>
      </header>

      {hasNoCases ? (
        <div className="lex-glass-card rounded-2xl px-5 py-10 text-center">
          <p className="text-base font-medium text-[color:var(--text-primary)]">Ainda não há casos neste escritório</p>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            Comece por criar um caso e seguir a entrevista guiada. Depois envie os documentos para o Lex organizar fatos e peças.
          </p>
          <Button className="mt-6" asChild>
            <HoverPrefetchLink href="/cases/new">Criar primeiro caso</HoverPrefetchLink>
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** Referência: metodologias por trás da home estão descritas em docs (sem jargão na UI). */
function WeeklyPlanningBlock({ className, id }: { className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={cn("lex-glass-card overflow-hidden rounded-2xl", className)}
    >
      <div className="flex items-start gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
        <div className="flex size-[26px] shrink-0 items-center justify-center rounded-[var(--r-md)] bg-violet-500/12 text-violet-200">
          <Calendar className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{DASHBOARD_HOME_UI_COPY.planejamentoSemanaTitulo}</h2>
        </div>
      </div>
      <div className="space-y-5 px-[18px] py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">{DASHBOARD_HOME_UI_COPY.metaSecao}</p>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-secondary)]">{DASHBOARD_HOME_UI_COPY.metaEmptyHonesto}</p>
          <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
            <HoverPrefetchLink href="/settings/readiness">Configurar meta</HoverPrefetchLink>
          </Button>
        </div>
        <div className="border-t border-[color:var(--border-subtle)] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
            {DASHBOARD_HOME_UI_COPY.tarefasAvulsasSecao}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-secondary)]">{DASHBOARD_HOME_UI_COPY.tarefasAvulsasIntro}</p>
          <ul className="mt-3 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-3 text-center text-[11px] text-[color:var(--text-muted)]">
            <li>{DASHBOARD_HOME_UI_COPY.tarefasAvulsasEmpty}</li>
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-3 w-full" disabled title="Função em preparação">
            Adicionar tarefa
          </Button>
        </div>
      </div>
    </section>
  );
}

function actionBucket(a: BriefingActionItem): BriefingActionEisenhowerBucket {
  return a.eisenhowerBucket ?? "maximum";
}

function sortResumePhaseKey(label: string): number {
  const order = [
    "Coleta inicial",
    "Aguardando documentos",
    "Pesquisa Lex AI",
    "Estratégia",
    "Minuta",
    "Revisão",
    "Pronto para exportar",
  ];
  const i = order.indexOf(label);
  return i === -1 ? 50 : i;
}

function ResumeCasesFlow({ rows }: { rows: ResumeCaseRow[] }) {
  const unnamed = rows.filter((r) => r.kind !== "named");
  const named = rows.filter((r): r is ResumeNamedCase => r.kind === "named");
  const byPhase = new Map<string, ResumeNamedCase[]>();
  for (const n of named) {
    const arr = byPhase.get(n.badgeLabel) ?? [];
    arr.push(n);
    byPhase.set(n.badgeLabel, arr);
  }
  const phaseKeys = [...byPhase.keys()].sort((a, b) => sortResumePhaseKey(a) - sortResumePhaseKey(b));

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[color:var(--text-muted)]">Sem casos para mostrar.</p>;
  }

  return (
    <div className="space-y-5 px-[18px] py-3">
      {unnamed.length > 0 ? (
        <div>
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Coleta inicial</h3>
          <ul className="divide-y divide-[color:var(--border-subtle)]">
            {unnamed.map((row) => (
              <ResumeCaseRowView
                key={row.kind === "unnamed_single" ? row.id : `group-${row.oldestCaseId}`}
                row={row}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {phaseKeys.map((phase) => (
        <div key={phase}>
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">{phase}</h3>
          <ul className="divide-y divide-[color:var(--border-subtle)]">
            {(byPhase.get(phase) ?? []).map((row) => (
              <ResumeCaseRowView key={row.id} row={row} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BriefingActionRows({ items }: { items: BriefingActionItem[] }) {
  return (
    <ul className="divide-y divide-[color:var(--border-subtle)]">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            <ActionIcon type={item.type} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[color:var(--text-primary)]">{item.title}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Motivo</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--text-secondary)]">{item.reason}</p>
              {item.statusHint ? <p className="mt-1 text-[10.5px] text-[color:var(--text-muted)]">{item.statusHint}</p> : null}
              {item.priority === "urgent" ? (
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium ${priorityStyles("urgent")}`}>
                  Atenção urgente
                </span>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 w-40 max-w-full shrink-0 justify-center self-start px-2 text-xs leading-tight sm:self-center"
            asChild
          >
            <HoverPrefetchLink href={item.href}>{item.cta}</HoverPrefetchLink>
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Corpo do briefing (pulso, prioridades, listas) — pode ir dentro de Suspense. */
export function MorningBriefingMainWithData({ data }: { data: MorningBriefingPayload }) {
  const {
    pulse,
    pulseCases,
    pulsePieces,
    pulseLibrary,
    urgent,
    briefingActions,
    briefingActionsOverflow,
    genuinelyAllClear,
    resumeCases,
    activities,
    docPhases,
    copilotMessage,
    copilotTitle,
    hasNoCases,
  } = data;

  if (hasNoCases) return null;

  const maximum = briefingActions.filter((a) => actionBucket(a) === "maximum");
  const important = briefingActions.filter((a) => actionBucket(a) === "important");
  const waiting = briefingActions.filter((a) => actionBucket(a) === "waiting");

  const cardsGrid = (
    <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <PulseBriefCard icon={Briefcase} label="Casos" variant="cases" detail={pulseCases} />
      <PulsePiecesBriefCard detail={pulsePieces} />
      <PulseBriefCard icon={Library} label="Biblioteca do escritório" variant="library" detail={pulseLibrary} />
    </div>
  );

  const mainColumn = (
    <>
      <section id="o-que-fazer-agora" className="lex-glass-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-1 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Sparkles className="size-4 text-violet-400" aria-hidden />
            <h2 className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{DASHBOARD_HOME_UI_COPY.oQueFazerAgora}</h2>
          </div>
          {!genuinelyAllClear && briefingActions.length > 0 ? (
            <span className="text-[11.5px] text-[color:var(--text-secondary)]">Até 5 ações · por urgência e impacto</span>
          ) : null}
        </div>
        <div className="px-[18px] py-3">
          {genuinelyAllClear && briefingActions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm font-medium text-[color:var(--text-primary)]">Tudo em dia por aqui.</p>
              <p className="max-w-sm text-xs text-[color:var(--text-secondary)]">
                Pode iniciar um novo caso, rever a biblioteca ou fazer uma pesquisa jurídica.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" asChild>
                  <HoverPrefetchLink href="/cases/new">Novo caso</HoverPrefetchLink>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <HoverPrefetchLink href="/biblioteca">Abrir biblioteca</HoverPrefetchLink>
                </Button>
              </div>
            </div>
          ) : briefingActions.length === 0 ? (
            <div className="space-y-1 py-8 text-center text-sm text-[color:var(--text-muted)]">
              <p>As prioridades podem estar no aviso acima ou na lista de casos.</p>
              <p className="text-xs">Abra um caso ou consulte a biblioteca para continuar.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {maximum.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/90">{DASHBOARD_HOME_UI_COPY.prioridadeMaxima}</p>
                  <BriefingActionRows items={maximum} />
                </div>
              ) : null}
              {important.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">{DASHBOARD_HOME_UI_COPY.importante}</p>
                  <BriefingActionRows items={important} />
                </div>
              ) : null}
              {waiting.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">{DASHBOARD_HOME_UI_COPY.aguardandoTerceiros}</p>
                  <BriefingActionRows items={waiting} />
                </div>
              ) : null}
              {briefingActionsOverflow > 0 ? (
                <div className="flex justify-end border-t border-[color:var(--border-subtle)] pt-3">
                  <HoverPrefetchLink href="/cases" className="text-xs font-medium text-violet-400 hover:text-violet-300">
                    Ver mais na lista de casos
                  </HoverPrefetchLink>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="lex-glass-card overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
          <Briefcase className="size-4 text-[color:var(--text-secondary)]" aria-hidden />
          <h2 className="flex-1 text-[13.5px] font-medium">{DASHBOARD_HOME_UI_COPY.casosPorFluxo}</h2>
          <HoverPrefetchLink href="/cases" className="text-xs font-medium text-violet-400 hover:text-violet-300">
            Ver todos
          </HoverPrefetchLink>
        </div>
        <ResumeCasesFlow rows={resumeCases} />
      </section>

      <section className="lex-glass-card overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
          <Activity className="size-4 text-[color:var(--text-secondary)]" aria-hidden />
          <h2 className="flex-1 text-[13.5px] font-medium">Atividade recente</h2>
        </div>
        <div className="px-[18px] py-3">
          {activities.length === 0 ? (
            <div className="py-4 text-center text-sm text-[color:var(--text-muted)]">
              <p>Nenhuma movimentação nas últimas horas.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activities.map((ev) => (
                <li key={ev.id} className="flex flex-col gap-0.5 border-b border-[color:var(--border-subtle)] pb-3 last:border-0 last:pb-0">
                  <p className="text-xs text-[color:var(--text-primary)]">{ev.line}</p>
                  <p className="text-[10.5px] text-[color:var(--text-muted)]">{ev.timeLabel}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );

  const rightRailRest = (
    <>
      <QuickActionsBlock />
      <ConsultLinksBlock />
      <DocPhasesBlock docPhases={docPhases} failedCount={pulse.failedProcessingCount} piecesThisMonth={data.piecesThisMonth} risks={pulse.openHighRisks} />
      <WeeklyPlanningBlock id="planejamento-semana" />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      {urgent ? (
        <div
          className="lex-glass-card flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3"
          role="status"
        >
          <AlertTriangle className="size-4 shrink-0 text-red-400" aria-hidden />
          <div className="min-w-0 flex-1 text-sm text-[color:var(--text-primary)]">
            <span className="font-medium text-red-300">{urgent.title}</span>
            <span className="text-[color:var(--text-secondary)]"> — {urgent.message}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-56 shrink-0 justify-center border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
            asChild
          >
            <HoverPrefetchLink href={urgent.href}>{urgent.ctaLabel}</HoverPrefetchLink>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:items-stretch lg:gap-5">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">{cardsGrid}</div>
        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2 lg:min-h-0">{mainColumn}</div>
        <CopilotBlock
          message={copilotMessage}
          title={copilotTitle}
          className="h-full min-w-0 lg:col-start-2 lg:row-start-1 lg:min-h-0"
        />
        <aside className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-2 lg:min-h-0">{rightRailRest}</aside>
      </div>
    </div>
  );
}

export function MorningBriefing({ data }: { data: MorningBriefingPayload }) {
  return (
    <>
      <MorningBriefingHeaderShell
        displayName={data.displayName}
        hasNoCases={data.hasNoCases}
        honorific={data.honorific}
      />
      <MorningBriefingMainWithData data={data} />
    </>
  );
}

function CopilotBlock({ message, title, className }: { message: string; title: string; className?: string }) {
  return (
    <div
      className={cn(
        "lex-glass-card flex h-full min-h-[168px] flex-col overflow-hidden rounded-2xl border border-violet-500/20 bg-[rgba(124,58,237,0.05)]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-violet-500/10 px-4 py-2.5 md:px-5">
        <div className="flex size-[26px] items-center justify-center rounded-[var(--r-md)] bg-[rgba(124,58,237,0.15)]">
          <Sparkles className="size-3.5 text-violet-300" aria-hidden />
        </div>
        <span className="flex-1 text-[13px] font-medium text-[color:var(--text-primary)]">{title}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-[18px] py-2.5">
        <p className="text-[12px] leading-snug text-[color:var(--text-secondary)] line-clamp-4">{message}</p>
        <div className="min-h-0 flex-1" aria-hidden />
      </div>
    </div>
  );
}

function QuickActionsBlock() {
  return (
    <section className="lex-glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Ações rápidas</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-[18px]">
        <QuickLink href="/cases/new" icon={Plus} iconClass="bg-violet-500/15 text-violet-300" label="Novo caso" />
        <QuickLink href="/documentos" icon={Upload} iconClass="bg-amber-500/15 text-amber-300" label="Upload" />
        <QuickLink href="/pesquisa-juridica" icon={Search} iconClass="bg-emerald-500/15 text-emerald-300" label="Pesquisa Lex" />
        <QuickLink href="/editor" icon={FileText} iconClass="bg-blue-500/15 text-blue-300" label="Criar peça" />
      </div>
    </section>
  );
}

function ConsultLinksBlock() {
  return (
    <section className="lex-glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Consultar</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-[18px]">
        <QuickLink href="/cases" icon={Briefcase} iconClass="bg-violet-500/15 text-violet-300" label="Casos" />
        <QuickLink href="/processos" icon={Scale} iconClass="bg-amber-500/15 text-amber-300" label="Processos" />
        <QuickLink href="/biblioteca" icon={Library} iconClass="bg-emerald-500/15 text-emerald-300" label="Biblioteca" />
        <QuickLink href="/busca" icon={Search} iconClass="bg-blue-500/15 text-blue-300" label="Busca global" />
      </div>
    </section>
  );
}

function DocPhasesBlock(props: {
  docPhases: MorningBriefingPayload["docPhases"];
  failedCount: number;
  piecesThisMonth: number;
  risks: number;
}) {
  return (
    <section className="lex-glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Fluxo de documentos</p>
      </div>
      <div className="space-y-5 px-[18px] py-3">
        {props.failedCount > 0 ? (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Atenção: {props.failedCount} documento{props.failedCount > 1 ? "s" : ""} precisam de ser reprocessados ou corrigidos.
            <Button variant="link" className="h-auto p-0 pl-1 text-amber-200" asChild>
              <HoverPrefetchLink href="/documentos">Ver documentos</HoverPrefetchLink>
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[var(--r-md)] bg-[color:var(--surface-overlay)] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Peças (mês)</p>
            <p className="text-lg font-medium text-[color:var(--text-primary)]">{props.piecesThisMonth}</p>
          </div>
          <div className="rounded-[var(--r-md)] bg-[color:var(--surface-overlay)] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Riscos elevados</p>
            <p className="text-lg font-medium text-[color:var(--text-primary)]">{props.risks}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {props.docPhases.map((ph) => (
            <li key={ph.key} className="flex items-center gap-2 py-0.5">
              <span className="w-24 shrink-0 text-xs text-[color:var(--text-secondary)]">{ph.label}</span>
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-sm bg-[color:var(--surface-overlay-strong)]">
                <div className="h-full rounded-sm" style={{ width: `${ph.barPct}%`, background: ph.color }} />
              </div>
              <span className="w-6 shrink-0 text-right font-mono text-[11px] text-[color:var(--text-muted)]">{ph.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ResumeCaseRowView({ row }: { row: ResumeCaseRow }) {
  if (row.kind === "unnamed_group") {
    return (
      <li>
        <HoverPrefetchLink
          href={`/cases/${row.oldestCaseId}/entrevista`}
          className="group flex flex-col gap-1 py-3 transition-colors hover:bg-[color:var(--surface-overlay)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-overlay-strong)] text-[11px] font-medium text-[color:var(--text-secondary)]">
              {row.count}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[color:var(--text-primary)]">
                {row.count} caso{row.count > 1 ? "s" : ""} sem título precisam de ser organizados
              </p>
              <p className="text-[11.5px] text-[color:var(--text-secondary)]">
                Coleta inicial · conclua a entrevista guiada e o nome para destravar o fluxo.
              </p>
            </div>
          </div>
          <span className="inline-flex h-8 w-40 shrink-0 items-center justify-center rounded-md border border-violet-500/20 bg-violet-500/10 text-xs font-medium text-violet-300 group-hover:border-violet-500/35 group-hover:bg-violet-500/15">
            Organizar agora
          </span>
        </HoverPrefetchLink>
      </li>
    );
  }

  if (row.kind === "unnamed_single") {
    return (
      <li>
        <HoverPrefetchLink
          href={`/cases/${row.id}/entrevista`}
          className="group flex flex-col gap-2 py-3 transition-colors hover:bg-[color:var(--surface-overlay)] sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-overlay-strong)] text-[11px] font-medium text-[color:var(--text-secondary)]">
              …
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[color:var(--text-primary)]">Novo caso sem título</p>
              <p className="text-[11.5px] text-[color:var(--text-secondary)]">
                Coleta inicial · criado em {row.createdLabel}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Próxima ação: {row.nextActionLabel}</p>
            </div>
          </div>
          <span className="inline-flex h-8 w-40 shrink-0 items-center justify-center rounded-md border border-violet-500/20 bg-violet-500/10 text-xs font-medium text-violet-300 group-hover:border-violet-500/35 group-hover:bg-violet-500/15">
            Continuar
          </span>
        </HoverPrefetchLink>
      </li>
    );
  }

  return (
    <li>
      <HoverPrefetchLink
        href={row.continueHref}
        className="group flex flex-col gap-2 py-3 transition-colors hover:bg-[color:var(--surface-overlay)] sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-medium text-violet-200">
            {row.title
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]!.toUpperCase())
              .join("")
              .slice(0, 3)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[color:var(--text-primary)] group-hover:text-violet-300">{row.title}</p>
            <p className="text-[11.5px] text-[color:var(--text-secondary)]">
              {row.statusLabel} · {row.progressPct}% pronto
              {row.lastActivityLabel ? ` · ${row.lastActivityLabel}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Próxima ação: {row.nextActionLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:pt-0.5">
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">{row.badgeLabel}</span>
          <div className="w-[72px]">
            <div className="h-0.5 overflow-hidden rounded-sm bg-[color:var(--surface-overlay-strong)]">
              <div className="h-full rounded-sm bg-[color:var(--brand-primary)]" style={{ width: `${row.progressPct}%` }} />
            </div>
          </div>
        </div>
      </HoverPrefetchLink>
    </li>
  );
}

function QuickLink(props: {
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClass: string;
  label: string;
}) {
  const Ico = props.icon;
  return (
    <HoverPrefetchLink
      href={props.href}
      className="flex items-center gap-2 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2.5 text-left transition-colors hover:border-violet-500/20 hover:bg-[rgba(124,58,237,0.06)]"
    >
      <div className={`flex size-[26px] shrink-0 items-center justify-center rounded-md ${props.iconClass}`}>
        <Ico className="size-3.5 text-current" aria-hidden />
      </div>
      <span className="text-xs font-medium text-[color:var(--text-primary)]">{props.label}</span>
    </HoverPrefetchLink>
  );
}
