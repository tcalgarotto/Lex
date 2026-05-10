/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { z } from "zod";
import type { LegalResearchResultType } from "./types";

const resultTypeZ: z.ZodType<LegalResearchResultType> = z.enum([
  "LAW",
  "JURISPRUDENCE",
  "THESIS",
  "STRATEGY",
  "DRAFTING_SUPPORT",
]);

export const legalResearchSearchBodySchema = z.object({
  workspaceId: z.string().optional(),
  query: z.string().min(2).max(8000),
  caseId: z.string().min(1).optional(),
  caseBrain: z.string().max(12_000).optional(),
  area: z.string().max(400).optional(),
  jurisdiction: z.string().max(200).optional(),
  courts: z.array(z.string().max(120)).max(40).optional(),
  dateRange: z
    .object({
      from: z.string().max(40).optional(),
      to: z.string().max(40).optional(),
    })
    .optional(),
  resultTypes: z.array(resultTypeZ).min(1),
  maxResults: z.number().int().min(1).max(20).optional().default(8),
  language: z.enum(["pt-BR"]).optional().default("pt-BR"),
});

export const legalResearchRecommendBodySchema = legalResearchSearchBodySchema.extend({
  caseId: z.string().min(1),
});

export const legalResearchPinBodySchema = z
  .object({
    caseId: z.string().min(1),
    candidateId: z.string().min(1).optional(),
    kind: z.enum(["foundation", "jurisprudence"]).optional(),
    note: z.string().max(2000).optional(),
    /** Corpo completo retornado pela pesquisa assistida (fundamento). */
    foundation: z.unknown().optional(),
    /** Corpo completo retornado pela pesquisa assistida (jurisprudência candidata). */
    jurisprudence: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    const hasFull =
      (data.foundation !== undefined && data.foundation !== null) ||
      (data.jurisprudence !== undefined && data.jurisprudence !== null);
    const legacy = Boolean(data.candidateId && data.kind);
    if (!hasFull && !legacy) {
      ctx.addIssue({
        code: "custom",
        message: "Envie foundation, jurisprudence ou o par candidateId+kind.",
        path: ["foundation"],
      });
    }
  });

export const legalResearchMarkVerifiedBodySchema = z
  .object({
    caseId: z.string().min(1),
    candidateId: z.string().min(1).optional(),
    pinnedId: z.string().min(1).optional(),
    kind: z.enum(["foundation", "jurisprudence"]),
    officialSourceUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.candidateId && !data.pinnedId) {
      ctx.addIssue({
        code: "custom",
        message: "Informe pinnedId ou candidateId.",
        path: ["pinnedId"],
      });
    }
  });
