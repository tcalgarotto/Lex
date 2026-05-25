import { CrmPipelineStage, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CrmPipelineSummary } from "./types";

const STAGES: CrmPipelineStage[] = [
  CrmPipelineStage.NEW,
  CrmPipelineStage.QUALIFIED,
  CrmPipelineStage.ACTIVE,
  CrmPipelineStage.WAITING_CLIENT,
  CrmPipelineStage.PROPOSAL,
  CrmPipelineStage.WON,
  CrmPipelineStage.LOST,
  CrmPipelineStage.ARCHIVED,
];

const contactCardSelect = {
  id: true,
  displayName: true,
  phoneE164: true,
  email: true,
  caseId: true,
  kind: true,
  pipelineStage: true,
  updatedAt: true,
} as const;

export type CrmPipelineContactCard = Prisma.CrmContactGetPayload<{
  select: typeof contactCardSelect;
}>;

export async function getCrmPipelineBoard(workspaceId: string): Promise<{
  stages: CrmPipelineSummary[];
  contactsByStage: Record<CrmPipelineStage, CrmPipelineContactCard[]>;
}> {
  const grouped = await prisma.crmContact.groupBy({
    by: ["pipelineStage"],
    where: { workspaceId, deletedAt: null },
    _count: { _all: true },
  });

  const stages: CrmPipelineSummary[] = STAGES.map((stage) => ({
    stage,
    count: grouped.find((g) => g.pipelineStage === stage)?._count._all ?? 0,
  }));

  const contacts = await prisma.crmContact.findMany({
    where: { workspaceId, deletedAt: null },
    select: contactCardSelect,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const contactsByStage = {} as Record<CrmPipelineStage, CrmPipelineContactCard[]>;
  for (const s of STAGES) {
    contactsByStage[s] = contacts.filter((c) => c.pipelineStage === s);
  }

  return { stages, contactsByStage };
}
