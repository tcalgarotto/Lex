import { z } from "zod";

/** Resposta esperada do modelo (organização; não inventar dados ausentes). */
export const deepseekStructureResponseSchema = z.object({
  parties: z
    .array(
      z.object({
        role: z.enum(["AUTHOR", "DEFENDANT", "INTERVENING", "OTHER"]),
        kind: z.enum(["PERSON", "COMPANY", "PUBLIC_ENTITY", "UNKNOWN"]).optional(),
        name: z.string(),
        document: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).optional(),
        sourceText: z.string().optional(),
      }),
    )
    .default([]),
  facts: z
    .array(
      z.object({
        text: z.string(),
        category: z.string().nullable().optional(),
        dates: z.array(z.string()).optional(),
        confidence: z.number().min(0).max(1).optional(),
        sourceText: z.string().optional(),
      }),
    )
    .default([]),
  requests: z
    .array(
      z.object({
        text: z.string(),
        kind: z.enum(["MAIN", "SUBSIDIARY", "URGENCY", "PROVISIONAL", "EVIDENCE", "PROCEDURAL", "OTHER"]).optional(),
        confidence: z.number().min(0).max(1).optional(),
        sourceText: z.string().optional(),
      }),
    )
    .default([]),
  risks: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        kind: z
          .enum([
            "REVOKED_NORM",
            "PRECEDENT_DIVERGENCE",
            "HISTORIC_VERSION",
            "MISSING_GROUNDING",
            "WEAK_ARGUMENT",
            "PROCEDURAL_GAP",
            "DOCUMENT_INCONSISTENCY",
            "OTHER",
          ])
          .optional(),
        confidence: z.number().min(0).max(1).optional(),
        sourceText: z.string().optional(),
      }),
    )
    .default([]),
  timeline: z
    .array(
      z.object({
        date: z.string().nullable().optional(),
        event: z.string(),
        who: z.string().nullable().optional(),
        documentRef: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .default([]),
  missing_documents: z.array(z.string()).default([]),
  missing_questions: z.array(z.string()).default([]),
  /** Lacunas de informação (não confundir com documentos ausentes). */
  information_gaps: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  case_summary: z.string().default(""),
  legal_area_suggestion: z.string().nullable().optional(),
  urgency_score: z.number().min(0).max(100).optional(),
  readiness_score: z.number().min(0).max(100).optional(),
  party_relations: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        relation: z.string(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .default([]),
  evidence_mentioned: z.array(z.string()).default([]),
  needs_confirmation: z.array(z.string()).default([]),
});

export type DeepseekStructureResponse = z.infer<typeof deepseekStructureResponseSchema>;

export function stripMarkdownJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenceMatch ? fenceMatch[1] : text) ?? "";
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return candidate.trim();
  return candidate.slice(start, end + 1);
}
