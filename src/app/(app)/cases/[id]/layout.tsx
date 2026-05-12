/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Building2, ChevronRight, Clock, Hash, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CaseSubnav } from "@/components/cases/case-subnav";
import { caseStatusLabel, isCasePreProcessual } from "@/lib/cases/labels";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import { CaseActions } from "@/components/cases/case-actions";
import { CaseProgressBar } from "@/components/cases/case-progress";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import { loadCaseForWorkspace } from "./_load-case";
import { CaseLegacyQueryRedirect } from "@/components/cases/case-legacy-query-redirect";
import { SetPageTitle } from "@/components/app/set-page-title";
import { getWorkspaceContext, getWorkspacesForUser } from "@/lib/auth/session";
import { gatherCaseBootstrap } from "@/lib/cases/case-bootstrap";
import { CaseBootstrapProvider } from "@/components/cases/case-bootstrap-context";


function readReadiness(metadataJson: unknown): ProceduralReadiness | null {
 if (!metadataJson || typeof metadataJson !== "object") return null;
 const m = metadataJson as { brain?: { proceduralReadiness?: unknown } };
 const r = m.brain?.proceduralReadiness;
 if (!r || typeof r !== "object") return null;
 const x = r as Partial<ProceduralReadiness>;
 if (typeof x.score !== "number" || typeof x.status !== "string") return null;
 return {
 score: x.score,
 status: x.status as ProceduralReadiness["status"],
 blockers: Array.isArray(x.blockers) ? x.blockers : [],
 missingDocuments: Array.isArray(x.missingDocuments) ? x.missingDocuments : [],
 nextBestAction: typeof x.nextBestAction === "string" ? x.nextBestAction : "",
 rationale: typeof x.rationale === "string" ? x.rationale : "",
 };
}

export default async function CaseDetailLayout({
 children,
 params,
}: {
 children: React.ReactNode;
 params: Promise<{ id: string }>;
}) {
 const { id } = await params;
 const { workspaceId, user } = await getWorkspaceContext();
 const [c, caseBootstrap] = await Promise.all([
 loadCaseForWorkspace(workspaceId, id),
 gatherCaseBootstrap(workspaceId, id, user.id),
 ]);
 if (!c) notFound();
 if (!caseBootstrap) notFound();

 const ws = await getWorkspacesForUser();
 const workspaceLabel = ws?.current.name ?? "Workspace";

 const tribunal = c.tribunalCode ? getTribunal(c.tribunalCode) : null;
 const preProcessual = isCasePreProcessual(c);
 const readiness = readReadiness(c.metadataJson);

 return (
 <>
 <SetPageTitle title={c.title} />
 <div className="w-full min-w-0 space-y-6">
 <header className="lex-glass lex-transition space-y-4 rounded-xl p-4 md:p-5">
 <nav className="flex flex-wrap items-center gap-1 text-[12px] md:text-[13px]" aria-label="Navegação do caso">
 <Link
 href="/cases"
 className="font-medium text-[color:var(--text-muted)] lex-transition hover:text-[color:var(--text-primary)]"
 >
 Casos
 </Link>
 <ChevronRight className="size-3.5 shrink-0 text-[color:var(--text-disabled)]" aria-hidden />
 <span className="max-w-[140px] truncate text-[color:var(--text-secondary)] md:max-w-xs">
 {workspaceLabel}
 </span>
 <ChevronRight className="size-3.5 shrink-0 text-[color:var(--text-disabled)]" aria-hidden />
 <span className="max-w-[200px] truncate font-medium text-[color:var(--text-primary)] md:max-w-md">
 {c.title}
 </span>
 </nav>

 <div className="flex flex-wrap items-center gap-2">
 <Badge
 variant="secondary"
 className="border-[0.5px] border-[color:var(--border-default)] text-[10px] uppercase tracking-wide text-[color:var(--text-secondary)]"
 >
 {caseStatusLabel(c.status)}
 </Badge>
 {preProcessual ? (
 <Badge
 variant="outline"
 className="border-[0.5px] border-[color:var(--brand-border)] bg-[color:var(--brand-subtle)] text-[10px] text-[color:var(--brand-text)]"
 >
 <Clock className="mr-1 size-3" aria-hidden /> Pré-processual
 </Badge>
 ) : null}
 {tribunal ? (
 <Badge
 variant="outline"
 className="border-[0.5px] border-[color:var(--border-default)] text-[10px] text-[color:var(--text-secondary)]"
 >
 <Building2 className="mr-1 size-3" aria-hidden /> {tribunal.code} · {tribunal.name}
 </Badge>
 ) : null}
 {c.uf ? (
 <Badge
 variant="outline"
 className="border-[0.5px] border-[color:var(--border-default)] text-[10px] text-[color:var(--text-secondary)]"
 >
 {c.uf}
 </Badge>
 ) : null}
 {c.processNumber ? (
 <Badge
 variant="outline"
 className="border-[0.5px] border-[color:var(--border-default)] font-mono text-[10px] text-[color:var(--text-secondary)]"
 >
 <Hash className="mr-1 size-3" aria-hidden />
 {c.processNumber}
 </Badge>
 ) : null}
 <Badge
 variant="outline"
 className="border-[0.5px] border-[color:var(--border-default)] text-[10px] text-[color:var(--text-secondary)]"
 >
 <Calendar className="mr-1 size-3" aria-hidden />
 {new Date(c.createdAt).toLocaleDateString("pt-BR")}
 </Badge>
 </div>

 <div className="flex flex-col gap-4 border-t border-[color:var(--border-subtle)] pt-4 md:flex-row md:items-start md:justify-between">
 <div className="min-w-0 space-y-1">
 <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-[color:var(--text-muted)]">
 <Sparkles className="size-3.5 text-[color:var(--brand-text)]" aria-hidden /> Caso
 </div>
 <h1 className="text-xl font-semibold leading-tight tracking-tight text-[color:var(--text-primary)] md:text-2xl">
 {c.title}
 </h1>
 {c.summary ? (
 <p className="max-w-3xl text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
 {c.summary}
 </p>
 ) : null}
 </div>
 <CaseActions caseId={c.id} readiness={readiness} />
 </div>
 </header>

 <CaseProgressBar caseData={c} />

 <CaseSubnav caseId={c.id} />

 <Suspense fallback={null}>
 <CaseLegacyQueryRedirect caseId={c.id} />
 </Suspense>

 <CaseBootstrapProvider caseId={c.id} initial={caseBootstrap}>
 {children}
 </CaseBootstrapProvider>
 </div>
 </>
 );
}
