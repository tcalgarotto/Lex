import type {
  CrmChannel,
  CrmContactKind,
  CrmMessageDirection,
  CrmPipelineStage,
} from "@prisma/client";

export type CreateCrmContactInput = {
  kind?: CrmContactKind;
  displayName: string;
  phoneE164?: string | null;
  email?: string | null;
  documentId?: string | null;
  pipelineStage?: CrmPipelineStage;
  clientId?: string | null;
  caseId?: string | null;
  optOutWhatsapp?: boolean;
  metadataJson?: Record<string, unknown>;
};

export type UpdateCrmContactInput = Partial<CreateCrmContactInput>;

export type ListCrmContactsFilters = {
  kind?: CrmContactKind;
  pipelineStage?: CrmPipelineStage;
  caseId?: string;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  cursor?: string;
};

export type AppendCrmMessageInput = {
  direction: CrmMessageDirection;
  body: string;
  sentAt?: Date;
  traceId?: string;
  deliveryStatus?: string;
  metaJson?: Record<string, unknown>;
};

export type CrmPipelineSummary = {
  stage: CrmPipelineStage;
  count: number;
};

export { CrmChannel, CrmContactKind, CrmMessageDirection, CrmPipelineStage };
