import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { getWorkspaceContext } from "@/lib/auth/session";
import { devLogLexTiming } from "@/lib/dev/server-timing";
import { lexGlassCtaClassName, lexPageLeadClassName, lexPageTitleClassName, lexTypeCardTitleClassName } from "@/lib/lex-ds";
import { listCases } from "@/lib/cases/repository";
import { caseStatusLabel } from "@/lib/cases/labels";
import { CaseCardActions } from "@/components/cases/case-card-actions";
import { HoverPrefetchLink } from "@/components/navigation/hover-prefetch-link";


export default async function CasesListPage({
 searchParams,
}: {
 searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
 const pageT0 = performance.now();
 const tWs = performance.now();
 const { workspaceId } = await getWorkspaceContext();
 devLogLexTiming("cases.getWorkspaceContext", performance.now() - tWs);
 const sp = (await searchParams) ?? {};
 const qRaw = typeof sp["q"] === "string" ? sp["q"] : Array.isArray(sp["q"]) ? sp["q"][0] : "";
 const q = qRaw?.trim() || null;
 const archived = sp["archived"] === "1";
 const tList = performance.now();
 const cases = await listCases(workspaceId, { take: 25, q, includeArchived: archived });
 devLogLexTiming("cases.listCases", performance.now() - tList);
 devLogLexTiming("cases.page", performance.now() - pageT0);
 const casesColLeft = cases.filter((_, i) => i % 2 === 0);
 const casesColRight = cases.filter((_, i) => i % 2 === 1);

 const pageTitleClassName = lexPageTitleClassName;
 const pageLeadClassName = lexPageLeadClassName;

 return (
 <>
 <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
 <div className="min-w-0 space-y-2">
 <h1 className={pageTitleClassName}>
 Casos
 </h1>
 <p className={pageLeadClassName}>
 Organize atendimentos, documentos, fundamentos e peças num só lugar — com histórico e rastreabilidade.
 </p>
 </div>
 <Link href="/cases/new" className={lexGlassCtaClassName}>
 Novo caso
 </Link>
 </header>

 <div className="lex-glass-card rounded-2xl p-4 md:p-5">
 <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" action="/cases">
 <Input
 name="q"
 defaultValue={qRaw}
 placeholder="Buscar por título, resumo ou CNJ…"
 className="h-11 min-h-[44px] w-full border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] text-base text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] sm:min-w-[320px] sm:flex-1 md:max-w-xl"
 />
 <div className="flex flex-wrap gap-2">
 <Button
 type="submit"
 variant="secondary"
 className="h-11 min-w-[100px] text-control font-medium"
 >
 Buscar
 </Button>
 <Button
 asChild
 type="button"
 variant={archived ? "secondary" : "outline"}
 className="h-11 text-control font-medium"
 >
 <Link href={archived ? "/cases" : "/cases?archived=1"}>
 {archived ? "Mostrando arquivados" : "Ver arquivados"}
 </Link>
 </Button>
 </div>
 </form>
 </div>

 {cases.length === 0 ? (
 <EmptyState
 className="w-full min-w-0"
 title={q ? "Nenhum resultado" : "Nenhum caso ainda"}
 description={
 q ? (
 <>
 Não encontrámos casos que correspondam a <span className="font-medium text-[color:var(--text-primary)]">«{q}»</span>.
 Experimente outras palavras ou crie um caso novo.
 </>
 ) : (
 "Crie um caso para organizar relato, documentos, partes, fatos, pedidos, riscos e próximas ações."
 )
 }
 action={{
 label: "Criar primeiro caso",
 href: "/cases/new",
 appearance: "glass",
 }}
 fullHeight
 />
 ) : (
 <>
 {/* md+: duas colunas em flex (pares / ímpares) — gap vertical fixo, sem altura de linha partilhada. */}
 <div className="flex flex-col gap-5 md:hidden">
 {cases.map((c) => (
 <CaseCard key={c.id} c={c} />
 ))}
 </div>
 <div className="hidden items-start gap-6 md:flex">
 <div className="flex min-w-0 flex-1 flex-col gap-5">
 {casesColLeft.map((c) => (
 <CaseCard key={c.id} c={c} />
 ))}
 </div>
 <div className="flex min-w-0 flex-1 flex-col gap-5">
 {casesColRight.map((c) => (
 <CaseCard key={c.id} c={c} />
 ))}
 </div>
 </div>
 </>
 )}
 </>
 );
}

type CaseRow = Awaited<ReturnType<typeof listCases>>[number];

function CaseCard({ c }: { c: CaseRow }) {
 const venue =
 [c.tribunalCode, c.uf].filter(Boolean).join(" · ") || (c.processNumber ? c.processNumber : null);
 const metaParts: string[] = [];
 const docN = c._count.documents;
 if (docN > 0) metaParts.push(docN === 1 ? "1 documento" : `${docN} documentos`);
 if (c._count.facts > 0) metaParts.push(c._count.facts === 1 ? "1 fato" : `${c._count.facts} fatos`);
 if (c._count.requests > 0)
 metaParts.push(c._count.requests === 1 ? "1 pedido" : `${c._count.requests} pedidos`);
 if (c._count.drafts > 0)
 metaParts.push(c._count.drafts === 1 ? "1 rascunho" : `${c._count.drafts} rascunhos`);
 const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : null;
 const updated = formatDistanceToNow(c.updatedAt, { addSuffix: true, locale: ptBR });
 const riskNote = c._count.risks > 0 ? `${c._count.risks} risco(s) em aberto` : null;

 return (
 <article className="lex-glass-card group relative flex flex-col overflow-hidden rounded-2xl p-4 md:p-5 lex-transition">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1 space-y-2">
 <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
 <Badge
 variant="secondary"
 className="border-[0.5px] border-[color:var(--border-default)] px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]"
 >
 {caseStatusLabel(c.status)}
 </Badge>
 {venue ? (
 <span className="text-caption text-[color:var(--text-muted)]">{venue}</span>
 ) : null}
 </div>
 <h2 className={`line-clamp-2 ${lexTypeCardTitleClassName}`}>
 {c.title}
 </h2>
 {c.summary ? (
 <p className="line-clamp-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
 {c.summary}
 </p>
 ) : null}
 </div>
 <div className="flex shrink-0 items-center gap-0.5">
 <HoverPrefetchLink
 href={`/cases/${c.id}`}
 aria-label={`Abrir caso ${c.title}`}
 className="rounded-lg p-2 text-[color:var(--text-muted)] lex-transition hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-primary)]"
 >
 <ArrowRight className="size-5" aria-hidden />
 </HoverPrefetchLink>
 <CaseCardActions caseId={c.id} caseTitle={c.title} archived={Boolean(c.archivedAt)} />
 </div>
 </div>
 <div className="mt-3 flex flex-col gap-1 border-t border-[color:var(--border-subtle)] pt-3 text-caption text-[color:var(--text-muted)]">
 <p className="leading-snug">
 {metaLine ? <span className="text-[color:var(--text-secondary)]">{metaLine}</span> : null}
 {metaLine ? <span className="mx-1.5 text-[color:var(--border-default)]">·</span> : null}
 <span>Atualizado {updated}</span>
 </p>
 {riskNote ? (
 <p className="text-caption font-medium text-[color:var(--warning-text)]">{riskNote}</p>
 ) : null}
 </div>
 </article>
 );
}
