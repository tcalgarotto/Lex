/**
 * Estado do checklist de entrevista guiada — compartilhado entre
 * `GET /api/cases/[id]/checklist` e `gatherCaseBootstrap` (uma única fonte).
 */

import { prisma } from "@/lib/prisma";
import type { ChecklistField, ChecklistTemplate } from "@/lib/cases/checklists/registry";
import {
  computeMissingFields,
  getChecklistTemplate,
  suggestChecklistTemplate,
} from "@/lib/cases/checklists/registry";

export type CaseChecklistStatePayload = {
  template: ChecklistTemplate | null;
  suggestedTemplate: boolean;
  answers: Record<string, unknown>;
  missingFields: ChecklistField[];
  answeredAt: string | null;
};

export async function resolveCaseChecklistTemplate(
  _workspaceId: string,
  templateId: string,
): Promise<ChecklistTemplate | null> {
  return getChecklistTemplate(templateId);
}

/**
 * Carrega o payload do checklist para o caso no workspace.
 * Retorna `null` se o caso não existir no workspace (multi-tenant).
 */
export async function loadCaseChecklistStateForBootstrap(
  workspaceId: string,
  caseId: string,
  qsTemplateId: string | null,
): Promise<CaseChecklistStatePayload | null> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true, rawInput: true, metadataJson: true },
  });
  if (!c) return null;

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const brain = (meta["brain"] ?? {}) as Record<string, unknown>;
  const existingResponses = brain["checklistResponses"] as
    | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string }
    | undefined;

  const explicitTemplateId =
    qsTemplateId ??
    existingResponses?.templateId ??
    (typeof meta["checklistTemplateId"] === "string" ? (meta["checklistTemplateId"] as string) : null);

  let template = explicitTemplateId ? await resolveCaseChecklistTemplate(workspaceId, explicitTemplateId) : null;
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

  return {
    template,
    suggestedTemplate: suggested,
    answers,
    missingFields,
    answeredAt: existingResponses?.answeredAt ?? null,
  };
}
