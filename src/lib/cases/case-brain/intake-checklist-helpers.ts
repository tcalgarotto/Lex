/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { prisma } from "@/lib/prisma";
import {
  computeMissingFields,
  getChecklistTemplate,
  type ChecklistTemplate,
} from "@/lib/cases/checklists/registry";

export { computeMissingFields, getChecklistTemplate };
export type { ChecklistTemplate };

export async function resolveInterviewTemplate(
  workspaceId: string,
  templateId: string,
): Promise<ChecklistTemplate | null> {
  const staticTpl = getChecklistTemplate(templateId);
  if (staticTpl) return staticTpl;

  const tpl = await prisma.interviewTemplate.findFirst({
    where: { id: templateId, workspaceId },
    select: { id: true, title: true, schemaJson: true, updatedAt: true },
  });
  if (!tpl) return null;
  if (!tpl.schemaJson || typeof tpl.schemaJson !== "object") return null;
  const schema = tpl.schemaJson as Record<string, unknown>;
  if (!Array.isArray(schema["sections"])) return null;
  if (!Array.isArray(schema["area"])) return null;
  if (!Array.isArray(schema["triggers"])) return null;

  const labelFromSchema = typeof schema["label"] === "string" ? (schema["label"] as string) : null;
  const versionFromSchema = typeof schema["version"] === "number" ? (schema["version"] as number) : null;

  const normalized: ChecklistTemplate = {
    ...(tpl.schemaJson as ChecklistTemplate),
    id: tpl.id,
    label: labelFromSchema ?? tpl.title,
    version: versionFromSchema ?? Math.max(1, Math.floor(tpl.updatedAt.getTime() / 1000)),
  };

  return normalized;
}
