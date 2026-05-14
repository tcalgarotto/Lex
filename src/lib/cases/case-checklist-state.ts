/**
 * Estado do checklist de entrevista — compartilhado entre
 * `GET /api/cases/[id]/checklist` e `gatherCaseBootstrap` (uma única fonte).
 *
 * Casos do fluxo fundamental (`metadataJson.intakeForm` / `intakeStructuredAt`)
 * não usam mais o template legado F2.1: pendências vêm do formulário fundamental.
 */

import { prisma } from "@/lib/prisma";
import type { ChecklistField, ChecklistTemplate } from "@/lib/cases/checklists/registry";
import {
  computeMissingFields,
  getChecklistTemplate,
  suggestChecklistTemplate,
} from "@/lib/cases/checklists/registry";
import { pendingRequiredLabels } from "@/components/cases/fundamental-intake-helpers";
import {
  isFundamentalIntakeStructured,
  parseFundamentalIntakeFromMetadata,
  usesFundamentalIntakeFlow,
} from "@/lib/cases/case-intake-source";

export type CaseChecklistIntakeMode = "legacy" | "fundamental_draft" | "fundamental_done";

export type CaseChecklistStatePayload = {
  template: ChecklistTemplate | null;
  suggestedTemplate: boolean;
  answers: Record<string, unknown>;
  missingFields: ChecklistField[];
  answeredAt: string | null;
  /** Quando o caso está no fluxo fundamental, `template` fica null e este campo orienta a UI. */
  intakeMode?: CaseChecklistIntakeMode;
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

  /** Fluxo atual: `/cases/new` + `POST /api/cases/fundamental-intake` — não misturar com checklist F2.1. */
  if (usesFundamentalIntakeFlow(meta)) {
    if (isFundamentalIntakeStructured(meta)) {
      const answeredAt =
        typeof meta["intakeStructuredAt"] === "string"
          ? meta["intakeStructuredAt"]
          : typeof meta["intakeFormSavedAt"] === "string"
            ? meta["intakeFormSavedAt"]
            : new Date().toISOString();
      return {
        template: null,
        suggestedTemplate: false,
        answers: {},
        missingFields: [],
        answeredAt,
        intakeMode: "fundamental_done",
      };
    }

    const parsedForm = parseFundamentalIntakeFromMetadata(meta);
    const pendingLabels = parsedForm ? pendingRequiredLabels(parsedForm) : ["Continuar a entrevista fundamental"];
    const missingFields: ChecklistField[] = pendingLabels.map((label, i) => ({
      id: `fundamental.pending.${i}`,
      label,
      kind: "text" as const,
      required: true,
    }));

    return {
      template: null,
      suggestedTemplate: false,
      answers: {},
      missingFields,
      answeredAt: null,
      intakeMode: "fundamental_draft",
    };
  }

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
    intakeMode: "legacy",
  };
}
