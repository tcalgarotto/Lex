import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  FileText,
  FolderOpen,
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
  BriefingActionItem,
  MorningBriefingPayload,
  PulseCasesDetail,
  PulseDocumentsDetail,
  PulseLibraryDetail,
  PulsePiecesDetail,
  ResumeCaseRow,
} from "@/lib/dashboard/morning-briefing-data";

function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function ActionIcon({ type }: { type: BriefingActionItem["type"] }) {
  const cls =
    "flex size-8 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[color:var(--surface-overlay)] text-[color:var(--text-secondary)]";
  if (type === "documento") return <div className={cls}><FileText className="size-[15px]" aria-hidden /></div>;
  if (type === "peça") return <div className={cls}><Scale className="size-[15px]" aria-hidden /></div>;
  if (type === "processo") return <div className={cls}><Link2 className="size-[15px]" aria-hidden /></div>;
  if (type === "pesquisa") return <div className={cls}><Search className="size-[15px]" aria-hidden /></div>;
  return <div className={cls}><Briefcase className="size-[15px]" aria-hidden /></div>;
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

  const casesDetail = variant === "cases" ? (detail as PulseCasesDetail) : null;
  const showNext = casesDetail?.nextActionTitle && casesDetail?.nextHref;

  return (
    <div className="flex min-h-[220px] flex-col rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
        <Ico className="size-[13px] opacity-80" aria-hidden />
        {label}
      </div>
      <p className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--text-primary)]">{detail.headline}</p>
      <ul className="mt-2 flex flex-col gap-0.5 text-[11.5px] leading-snug text-[color:var(--text-secondary)]">
        {detail.breakdownLines.map((line, i) => (
          <li key={`${i}-${line.slice(0, 24)}`}>· {line}</li>
        ))}
      </ul>
      {showNext ? (
        <div className="mt-3 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2">
          <p className="text-[9px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Próxima ação sugerida</p>
          <p className="mt-0.5 text-[11.5px] text-[color:var(--text-primary)]">{casesDetail!.nextActionTitle}</p>
          <Button size="sm" className="mt-2 h-7 w-full text-[11px]" asChild>
            <Link href={casesDetail!.nextHref!}>{casesDetail!.nextCtaLabel}</Link>
          </Button>
        </div>
      ) : null}
      <div className="mt-auto pt-3">
        <div className="h-0.5 overflow-hidden rounded-sm bg-[color:var(--surface-overlay-strong)]">
          <div className="h-full rounded-sm" style={{ width: `${Math.min(100, detail.barPct)}%`, background: detail.barColor }} />
        </div>
        <Link href={footerHref} className="mt-2 inline-block text-[11px] font-medium text-violet-400 hover:text-violet-300">
          {footerLabel} →
        </Link>
      </div>
    </div>
  );
}

function PulsePiecesBriefCard({ detail }: { detail: PulsePiecesDetail }) {
  return (
    <div className="flex min-h-[220px] flex-col rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
        <Scale className="size-[13px] opacity-80" aria-hidden />
        Peças em elaboração
      </div>
      <p className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--text-primary)]">{detail.headline}</p>
      <ul className="mt-2 flex flex-col gap-0.5 text-[11.5px] leading-snug text-[color:var(--text-secondary)]">
        {detail.breakdownLines.map((line, i) => (
          <li key={`${i}-${line.slice(0, 24)}`}>· {line}</li>
        ))}
      </ul>
      {detail.emptyHint ? (
        <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--text-muted)]">{detail.emptyHint}</p>
      ) : null}
      <div className="mt-auto pt-3">
        <div className="h-0.5 overflow-hidden rounded-sm bg-[color:var(--surface-overlay-strong)]">
          <div className="h-full rounded-sm" style={{ width: `${Math.min(100, detail.barPct)}%`, background: detail.barColor }} />
        </div>
        <Link href={detail.nextHref} className="mt-2 inline-block text-[11px] font-medium text-violet-400 hover:text-violet-300">
          {detail.nextCtaLabel} →
        </Link>
      </div>
    </div>
  );
}

export function MorningBriefing({ data }: { data: MorningBriefingPayload }) {
  const {
    pulse,
    pulseCases,
    pulseDocuments,
    pulsePieces,
    pulseLibrary,
    urgent,
    briefingActions,
    genuinelyAllClear,
    resumeCases,
    activities,
    docPhases,
    copilotMessage,
    copilotTitle,
    displayName,
    isAdmin,
    hasNoCases,
    oldestUnnamedCaseId,
    daySummaryLine,
    priorityContinueHref,
  } = data;

  const dateLine = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-w-0 space-y-5">
      <h1 className="sr-only">Briefing do dia — Lex</h1>

      <header className="space-y-3">
        <div>
          <p className="text-xl font-medium tracking-tight text-[color:var(--text-primary)]">
            {salutation()}, <span className="text-[color:var(--brand-primary)]">{displayName}</span>
          </p>
          <p className="mt-1 text-sm capitalize text-[color:var(--text-secondary)]">{dateLine}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)]">{daySummaryLine}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href={priorityContinueHref}>Continuar prioridade</Link>
          </Button>
          {oldestUnnamedCaseId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/cases/${oldestUnnamedCaseId}/entrevista`}>Nomear e continuar caso</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href="/cases/new">Novo caso</Link>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href="/documentos">Enviar documento</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pesquisa-juridica">Pesquisa jurídica</Link>
          </Button>
        </div>
      </header>

      {hasNoCases ? (
        <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-5 py-10 text-center">
          <p className="text-base font-medium text-[color:var(--text-primary)]">Ainda não há casos neste escritório</p>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            Comece por criar um caso e seguir a entrevista guiada. Depois envie os documentos para o Lex organizar fatos e peças.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/cases/new">Criar primeiro caso</Link>
          </Button>
        </div>
      ) : null}

      {!hasNoCases ? (
        <div className="flex flex-col gap-5">
          {urgent ? (
            <div
              className="flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] border border-red-500/20 bg-red-500/[0.06] px-4 py-3"
              role="status"
            >
              <AlertTriangle className="size-4 shrink-0 text-red-400" aria-hidden />
              <div className="min-w-0 flex-1 text-sm text-[color:var(--text-primary)]">
                <span className="font-medium text-red-300">{urgent.title}</span>
                <span className="text-[color:var(--text-secondary)]"> — {urgent.message}</span>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15" asChild>
                <Link href={urgent.href}>{urgent.ctaLabel} →</Link>
              </Button>
            </div>
          ) : null}

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <PulseBriefCard icon={Briefcase} label="Casos em andamento" variant="cases" detail={pulseCases} />
            <PulseBriefCard icon={FolderOpen} label="Documentos para analisar" variant="documents" detail={pulseDocuments} />
            <PulsePiecesBriefCard detail={pulsePieces} />
            <PulseBriefCard icon={Library} label="Biblioteca" variant="library" detail={pulseLibrary} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              <section id="o-que-fazer-agora" className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
                <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
                  <Sparkles className="size-4 text-violet-400" aria-hidden />
                  <h2 className="flex-1 text-[13.5px] font-medium text-[color:var(--text-primary)]">O que fazer agora</h2>
                  {!genuinelyAllClear && briefingActions.length > 0 ? (
                    <span className="text-[11.5px] text-[color:var(--text-secondary)]">Até 5 prioridades</span>
                  ) : null}
                </div>
                <div className="px-[18px] py-3">
                  {genuinelyAllClear && briefingActions.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">Tudo em dia por aqui.</p>
                      <p className="max-w-sm text-xs text-[color:var(--text-secondary)]">
                        Você pode criar um novo caso, revisar a biblioteca ou iniciar uma pesquisa jurídica.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" asChild>
                          <Link href="/cases/new">Novo caso</Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/biblioteca">Abrir biblioteca</Link>
                        </Button>
                      </div>
                    </div>
                  ) : briefingActions.length === 0 ? (
                    <div className="space-y-1 py-8 text-center text-sm text-[color:var(--text-muted)]">
                      <p>As prioridades podem estar no aviso acima ou na lista de casos.</p>
                      <p className="text-xs">Abra um caso ou consulte a biblioteca para continuar.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[color:var(--border-subtle)]">
                      {briefingActions.map((item) => (
                        <li key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 gap-3">
                            <ActionIcon type={item.type} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-[color:var(--text-primary)]">{item.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--text-secondary)]">{item.reason}</p>
                              {item.statusHint ? (
                                <p className="mt-1 text-[10.5px] text-[color:var(--text-muted)]">{item.statusHint}</p>
                              ) : null}
                              {item.priority === "urgent" ? (
                                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium ${priorityStyles("urgent")}`}>
                                  Atenção necessária
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <Button size="sm" className="shrink-0 self-start sm:self-center" asChild>
                            <Link href={item.href}>{item.cta} →</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <CopilotBlock message={copilotMessage} title={copilotTitle} className="lg:hidden" />

              <section className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
                <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
                  <Briefcase className="size-4 text-[color:var(--text-secondary)]" aria-hidden />
                  <h2 className="flex-1 text-[13.5px] font-medium">Casos para retomar</h2>
                  <Link href="/cases" className="flex items-center gap-0.5 text-xs font-medium text-violet-400 hover:text-violet-300">
                    Ver todos <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
                <div className="px-[18px] py-1">
                  {resumeCases.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[color:var(--text-muted)]">Sem casos para mostrar.</p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--border-subtle)]">
                      {resumeCases.map((row) => (
                        <ResumeCaseRowView
                          key={
                            row.kind === "named"
                              ? row.id
                              : row.kind === "unnamed_single"
                                ? row.id
                                : `group-${row.oldestCaseId}`
                          }
                          row={row}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
                <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
                  <Activity className="size-4 text-[color:var(--text-secondary)]" aria-hidden />
                  <h2 className="flex-1 text-[13.5px] font-medium">Movimentação (24h)</h2>
                </div>
                <div className="px-[18px] py-3">
                  {activities.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[color:var(--text-muted)]">
                      <p>Nenhuma atividade recente nos seus casos.</p>
                      <p className="mt-1 text-xs">Envie documentos ou continue a entrevista de um caso.</p>
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
            </div>

            <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
              <CopilotBlock message={copilotMessage} title={copilotTitle} />
              <QuickActionsBlock />
              <DocPhasesBlock docPhases={docPhases} failedCount={pulse.failedProcessingCount} piecesThisMonth={data.piecesThisMonth} risks={pulse.openHighRisks} />
              <ConsultLinksBlock />
              {isAdmin ? <AdminToolsCollapsible /> : null}
            </aside>
          </div>

          <div className="flex flex-col gap-4 lg:hidden">
            <QuickActionsBlock />
            <DocPhasesBlock docPhases={docPhases} failedCount={pulse.failedProcessingCount} piecesThisMonth={data.piecesThisMonth} risks={pulse.openHighRisks} />
            <ConsultLinksBlock />
            {isAdmin ? <AdminToolsCollapsible /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CopilotBlock({ message, title, className }: { message: string; title: string; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--r-lg)] border border-violet-500/20 bg-[rgba(124,58,237,0.05)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-violet-500/10 px-4 py-3">
        <div className="flex size-[26px] items-center justify-center rounded-[var(--r-md)] bg-[rgba(124,58,237,0.15)]">
          <Sparkles className="size-3.5 text-violet-300" aria-hidden />
        </div>
        <span className="flex-1 text-[13px] font-medium text-[color:var(--text-primary)]">{title}</span>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-[color:var(--text-secondary)]">{message}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="border-violet-500/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15" asChild>
            <Link href="#o-que-fazer-agora">Ver prioridades</Link>
          </Button>
          <Button size="sm" variant="outline" className="border-violet-500/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15" asChild>
            <Link href="/pesquisa-juridica">Pesquisa jurídica</Link>
          </Button>
          <Button size="sm" variant="outline" className="border-violet-500/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15" asChild>
            <Link href="/cases/new">Novo caso</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuickActionsBlock() {
  return (
    <section className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Ações</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-[18px]">
        <QuickLink href="/cases/new" icon={Plus} iconClass="bg-violet-500/15 text-violet-300" label="Novo caso" />
        <QuickLink href="/documentos" icon={Upload} iconClass="bg-amber-500/12 text-amber-400" label="Enviar documento" />
        <QuickLink href="/pesquisa-juridica" icon={Search} iconClass="bg-emerald-500/10 text-emerald-400" label="Pesquisa jurídica" />
        <QuickLink href="/editor" icon={FileText} iconClass="bg-blue-500/10 text-blue-400" label="Criar peça" />
      </div>
    </section>
  );
}

function ConsultLinksBlock() {
  return (
    <section className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Consultar</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-[18px]">
        <QuickLink href="/cases" icon={Briefcase} iconClass="bg-violet-500/12 text-violet-300" label="Todos os casos" />
        <QuickLink href="/processos" icon={Scale} iconClass="bg-amber-500/10 text-amber-300" label="Processos" />
        <QuickLink href="/biblioteca" icon={Library} iconClass="bg-emerald-500/10 text-emerald-300" label="Biblioteca" />
        <QuickLink href="/busca" icon={Search} iconClass="bg-blue-500/10 text-blue-300" label="Busca global" />
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
    <section className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Documentos do escritório</p>
      </div>
      <div className="space-y-3 px-[18px] py-3">
        {props.failedCount > 0 ? (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {props.failedCount} documento{props.failedCount > 1 ? "s" : ""} precisam de atenção.
            <Button variant="link" className="h-auto p-0 pl-1 text-amber-200" asChild>
              <Link href="/documentos">Ver documentos</Link>
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[var(--r-md)] bg-[color:var(--surface-overlay)] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Peças (mês)</p>
            <p className="text-lg font-medium text-[color:var(--text-primary)]">{props.piecesThisMonth}</p>
            <p className="text-[11px] text-[color:var(--text-secondary)]">novas no escritório</p>
          </div>
          <div className="rounded-[var(--r-md)] bg-[color:var(--surface-overlay)] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">Riscos elevados</p>
            <p className="text-lg font-medium text-[color:var(--text-primary)]">{props.risks}</p>
            <p className="text-[11px] text-[color:var(--text-secondary)]">em aberto nos casos</p>
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

function AdminToolsCollapsible() {
  return (
    <details className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <summary className="cursor-pointer px-[18px] py-3 text-xs font-medium text-[color:var(--text-secondary)]">
        Ferramentas internas
      </summary>
      <div className="flex flex-col gap-1 border-t border-[color:var(--border-subtle)] px-[18px] py-3 text-sm">
        <Link href="/cockpit" className="text-violet-400 hover:text-violet-300">
          Cockpit
        </Link>
        <Link href="/settings/jobs" className="text-violet-400 hover:text-violet-300">
          Fila de tarefas
        </Link>
        <Link href="/settings/readiness" className="text-violet-400 hover:text-violet-300">
          Estado do sistema
        </Link>
      </div>
    </details>
  );
}

function ResumeCaseRowView({ row }: { row: ResumeCaseRow }) {
  if (row.kind === "unnamed_group") {
    return (
      <li>
        <Link
          href={`/cases/${row.oldestCaseId}/entrevista`}
          className="group flex flex-col gap-1 py-3 transition-colors hover:bg-[color:var(--surface-overlay)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-overlay-strong)] text-[11px] font-medium text-[color:var(--text-secondary)]">
              +{row.count}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[color:var(--text-primary)]">
                Mais {row.count} caso{row.count > 1 ? "s" : ""} sem título
              </p>
              <p className="text-[11.5px] text-[color:var(--text-secondary)]">
                Coleta inicial · organize e nomeie na entrevista guiada para não perder o rasto.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-violet-400 group-hover:text-violet-300">Organizar →</span>
        </Link>
      </li>
    );
  }

  if (row.kind === "unnamed_single") {
    return (
      <li>
        <Link
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
          <span className="shrink-0 text-xs font-medium text-violet-400 group-hover:text-violet-300">Continuar →</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Link
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
      </Link>
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
    <Link
      href={props.href}
      className="flex items-center gap-2 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2.5 text-left transition-colors hover:border-violet-500/20 hover:bg-[rgba(124,58,237,0.06)]"
    >
      <div className={`flex size-[26px] shrink-0 items-center justify-center rounded-md ${props.iconClass}`}>
        <Ico className="size-3.5" aria-hidden />
      </div>
      <span className="text-xs font-medium text-[color:var(--text-primary)]">{props.label}</span>
    </Link>
  );
}
