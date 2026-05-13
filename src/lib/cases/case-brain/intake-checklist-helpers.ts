/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import {
  computeMissingFields,
  getChecklistTemplate,
  type ChecklistTemplate,
} from "@/lib/cases/checklists/registry";

export { computeMissingFields, getChecklistTemplate };
export type { ChecklistTemplate };

export async function resolveChecklistTemplate(
  _workspaceId: string,
  templateId: string,
): Promise<ChecklistTemplate | null> {
  return getChecklistTemplate(templateId);
}
