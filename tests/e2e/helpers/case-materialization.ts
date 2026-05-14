import { prisma } from "../../../src/lib/prisma";

export type CaseMaterializationCounts = {
  parties: number;
  facts: number;
  requests: number;
  risks: number;
};

export async function countCaseMaterialization(caseId: string): Promise<CaseMaterializationCounts> {
  const [parties, facts, requests, risks] = await Promise.all([
    prisma.caseParty.count({ where: { caseId } }),
    prisma.caseFact.count({ where: { caseId } }),
    prisma.caseRequest.count({ where: { caseId } }),
    prisma.caseRisk.count({ where: { caseId } }),
  ]);
  return { parties, facts, requests, risks };
}

export async function readCaseIntakeMeta(caseId: string): Promise<{
  intakeStructuredAt: unknown;
  intakeForm: unknown;
}> {
  const row = await prisma.case.findFirst({
    where: { id: caseId, deletedAt: null },
    select: { metadataJson: true },
  });
  const meta = (row?.metadataJson ?? {}) as Record<string, unknown>;
  return {
    intakeStructuredAt: meta["intakeStructuredAt"],
    intakeForm: meta["intakeForm"],
  };
}
