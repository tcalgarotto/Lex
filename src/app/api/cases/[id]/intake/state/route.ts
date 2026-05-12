/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  computeMissingFields,
  getChecklistTemplate,
  suggestChecklistTemplate,
} from "@/lib/cases/checklists/registry";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { resolveInterviewTemplate } from "@/lib/cases/case-brain/intake-checklist-helpers";


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId } = await params;
  const url = new URL(req.url);
  const qsTemplateId = url.searchParams.get("templateId");

  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true, rawInput: true, metadataJson: true },
  });
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const brain = (meta["brain"] ?? {}) as Record<string, unknown>;
  const existingResponses = brain["checklistResponses"] as
    | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string }
    | undefined;

  const explicitTemplateId =
    qsTemplateId ??
    existingResponses?.templateId ??
    (typeof meta["checklistTemplateId"] === "string" ? (meta["checklistTemplateId"] as string) : null);

  let template = explicitTemplateId ? await resolveInterviewTemplate(workspaceId, explicitTemplateId) : null;
  let suggested = false;
  if (!template) {
    const areas = Array.isArray(brain["area"]) ? (brain["area"] as string[]) : [];
    template = suggestChecklistTemplate({ rawText: c.rawInput, brainAreas: areas });
    suggested = !!template;
  }
  if (!template) {
    template = getChecklistTemplate("generic.offline.intake");
    suggested = false;
  }

  const answers = existingResponses?.answers ?? {};
  const missingFields = template ? computeMissingFields(template, answers) : [];

  return NextResponse.json({
    template,
    suggestedTemplate: suggested,
    answers,
    missingFields,
    answeredAt: existingResponses?.answeredAt ?? null,
  });
}
