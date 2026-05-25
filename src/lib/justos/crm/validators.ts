import { z } from "zod";
import { CrmContactKind, CrmMessageDirection, CrmPipelineStage } from "@prisma/client";

export const CreateCrmContactSchema = z.object({
  kind: z.nativeEnum(CrmContactKind).optional(),
  displayName: z.string().min(1).max(200),
  phoneE164: z.string().max(32).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  documentId: z.string().max(64).optional().nullable(),
  pipelineStage: z.nativeEnum(CrmPipelineStage).optional(),
  clientId: z.string().cuid().optional().nullable(),
  caseId: z.string().cuid().optional().nullable(),
  optOutWhatsapp: z.boolean().optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateCrmContactSchema = CreateCrmContactSchema.partial();

export const ChangeStageSchema = z.object({
  pipelineStage: z.nativeEnum(CrmPipelineStage),
});

export const AppendMessageSchema = z.object({
  body: z.string().min(1).max(8000),
  direction: z.nativeEnum(CrmMessageDirection).default(CrmMessageDirection.OUTBOUND),
  traceId: z.string().max(120).optional(),
  deliveryStatus: z.string().max(64).optional(),
});

export const ListContactsQuerySchema = z.object({
  kind: z.nativeEnum(CrmContactKind).optional(),
  pipelineStage: z.nativeEnum(CrmPipelineStage).optional(),
  caseId: z.string().cuid().optional(),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().cuid().optional(),
});
