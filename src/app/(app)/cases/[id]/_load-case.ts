import { cache } from "react";
import { getCaseById } from "@/lib/cases/repository";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

export const loadCaseForWorkspace = cache((workspaceId: string, caseId: string) =>
  getCaseById(workspaceId, caseId),
);

export type CaseDetailRecord = NonNullable<Awaited<ReturnType<typeof loadCaseForWorkspace>>>;
