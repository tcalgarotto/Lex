/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { prisma } from "@/lib/prisma";

/**
 * Documentos ligados a caso: por padrão **não** recebem indexação semântica no acervo
 * do escritório (vetores). Somente texto extraído + metadados no caso.
 * Opt-in explícito: incluir `documentId` em `caseBrain.documentSemanticIndexDocIds`.
 */
export async function caseDocumentAllowsSemanticIndex(caseId: string, documentId: string): Promise<boolean> {
  const c = await prisma.case.findFirst({
    where: { id: caseId },
    select: { metadataJson: true },
  });
  const meta = (c?.metadataJson ?? {}) as Record<string, unknown>;
  const caseBrain = (meta["caseBrain"] ?? {}) as Record<string, unknown>;
  const allow = caseBrain["documentSemanticIndexDocIds"];
  if (!Array.isArray(allow)) return false;
  return allow.some((x) => x === documentId);
}
