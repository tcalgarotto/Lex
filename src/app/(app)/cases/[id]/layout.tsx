/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CaseSubnav } from "@/components/cases/case-subnav";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import { loadCaseForWorkspace } from "./_load-case";
import { CaseLegacyQueryRedirect } from "@/components/cases/case-legacy-query-redirect";
import { SetPageTitle } from "@/components/app/set-page-title";
import { getWorkspaceContext, getWorkspacesForUser } from "@/lib/auth/session";
import { gatherCaseBootstrap } from "@/lib/cases/case-bootstrap";
import { CaseBootstrapProvider } from "@/components/cases/case-bootstrap-context";
import { CaseCockpitHeader } from "@/components/cases/case-cockpit-header";
import { CaseCopilotPanel } from "@/components/cases/case-copilot-panel";
import { CaseDetailRightRail } from "@/components/cases/case-detail-right-rail";
import { LexPageFrame } from "@/components/layout/lex-page-frame";
import {
  resolveCaseCockpitPrimaryAction,
  type CaseCockpitActionContext,
} from "@/lib/cases/case-cockpit-primary-action";
import { computeCaseLegalWorkflow } from "@/lib/cases/case-legal-workflow";

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
  const readiness = readReadiness(c.metadataJson);
  const checklistMissingCount = caseBootstrap.checklist.missingFields.length;
  const draftBlocked = readiness?.status === "insuficiente";

  const actionCtx: CaseCockpitActionContext = {
    caseId: c.id,
    checklistMissingCount,
    documents: c.documents.map((d) => ({ status: d.status, updatedAt: d.updatedAt })),
    facts: c.facts,
    parties: c.parties,
    requests: c.requests,
    legalSources: c.legalSources,
    drafts: c.drafts,
    reviews: c.reviews,
    metadataJson: c.metadataJson,
  };
  const primaryAction = resolveCaseCockpitPrimaryAction(actionCtx, {
    draftBlocked: Boolean(draftBlocked),
  });

  const openRiskCount = c.risks.filter((r) => !r.resolvedAt).length;

  const workflow = computeCaseLegalWorkflow({
    metadataJson: c.metadataJson,
    rawInput: c.rawInput ?? null,
    checklistMissingCount,
    checklistAnsweredAt: caseBootstrap.checklist.answeredAt,
    documents: c.documents.map((d) => ({ status: d.status, updatedAt: d.updatedAt })),
    facts: c.facts,
    parties: c.parties,
    requests: c.requests,
    legalSources: c.legalSources,
    drafts: c.drafts,
    reviews: c.reviews,
    readiness,
    draftBlocked: Boolean(draftBlocked),
    caseUpdatedAt: c.updatedAt,
    caseCreatedAt: c.createdAt,
    openRiskCount,
  });

  const copilot = (
    <CaseCopilotPanel
      caseRecord={c}
      readiness={readiness}
      checklistMissingCount={checklistMissingCount}
      primary={primaryAction}
      workflow={workflow}
    />
  );

  return (
    <>
      <SetPageTitle title="Detalhe do caso" />
      <LexPageFrame
        centerWidth="default"
        rightRail={<CaseDetailRightRail>{copilot}</CaseDetailRightRail>}
      >
        <div className="space-y-6">
          <CaseCockpitHeader
            caseRecord={c}
            workspaceLabel={workspaceLabel}
            readiness={readiness}
            primaryAction={primaryAction}
            workflow={workflow}
          />
          <div className="xl:hidden">{copilot}</div>
          <CaseSubnav caseId={c.id} />

          <Suspense fallback={null}>
            <CaseLegacyQueryRedirect caseId={c.id} />
          </Suspense>

          <CaseBootstrapProvider caseId={c.id} initial={caseBootstrap}>
            {children}
          </CaseBootstrapProvider>
        </div>
      </LexPageFrame>
    </>
  );
}
