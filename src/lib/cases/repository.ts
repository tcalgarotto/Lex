/**
 * Repository CRUD do módulo Legal Workflow Automation.
 *
 * - SEMPRE escopa por workspaceId (multi-tenant).
 * - Toda operação que cria/atualiza um Case adiciona um evento na timeline.
 * - Drafts são versionados sequencialmente por caso.
 * - Reviews retornam o último para o consumidor (mantém histórico).
 *
 * Não inclui regras de negócio (intake, drafting, review).
 * Apenas persistência idempotente.
 */

import {
  CaseDraftStatus,
  CaseStatus,
  CaseTimelineKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IntakeResult,
  ParsedFact,
  ParsedParty,
  ParsedRequest,
  ParsedRisk,
} from "./types";

export type CreateCaseFromIntakeArgs = {
  workspaceId: string;
  createdById: string;
  rawInput: string;
  intake: IntakeResult;
};

export async function createCaseFromIntake(args: CreateCaseFromIntakeArgs) {
  const { workspaceId, createdById, rawInput, intake } = args;
  return prisma.$transaction(async (tx) => {
    const c = await tx.case.create({
      data: {
        workspaceId,
        createdById,
        title: intake.title,
        summary: intake.summary,
        rawInput,
        status: CaseStatus.RESEARCH,
        ...(intake.tribunalCode ? { tribunalCode: intake.tribunalCode } : {}),
        ...(intake.uf ? { uf: intake.uf } : {}),
        ...(intake.processNumber ? { processNumber: intake.processNumber } : {}),
      },
    });

    if (intake.facts.length) {
      await tx.caseFact.createMany({ data: intake.facts.map((f) => mapFact(c.id, f)) });
    }
    if (intake.parties.length) {
      await tx.caseParty.createMany({ data: intake.parties.map((p) => mapParty(c.id, p)) });
    }
    if (intake.requests.length) {
      await tx.caseRequest.createMany({ data: intake.requests.map((r) => mapRequest(c.id, r)) });
    }
    if (intake.risks.length) {
      await tx.caseRisk.createMany({ data: intake.risks.map((r) => mapRisk(c.id, r)) });
    }

    await tx.caseTimelineEvent.createMany({
      data: [
        {
          caseId: c.id,
          kind: CaseTimelineKind.CASE_CREATED,
          message: `Caso criado: ${intake.title}`,
          userId: createdById,
        },
        {
          caseId: c.id,
          kind: CaseTimelineKind.INTAKE_COMPLETED,
          message: `Intake concluído: ${intake.facts.length} fatos · ${intake.requests.length} pedidos · ${intake.parties.length} partes`,
          payloadJson: {
            tribunalCode: intake.tribunalCode ?? null,
            uf: intake.uf ?? null,
            processNumber: intake.processNumber ?? null,
          },
          userId: createdById,
        },
      ],
    });

    return c;
  });
}

export async function getCaseById(workspaceId: string, caseId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    include: {
      facts: { orderBy: { ordinal: "asc" } },
      parties: { orderBy: { createdAt: "asc" } },
      requests: { orderBy: { ordinal: "asc" } },
      risks: { orderBy: { createdAt: "desc" } },
      drafts: { orderBy: { version: "desc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 5 },
      timeline: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

export async function listCases(
  workspaceId: string,
  opts: { take?: number; status?: CaseStatus | null } = {},
) {
  const take = Math.min(50, Math.max(1, opts.take ?? 20));
  return prisma.case.findMany({
    where: {
      workspaceId,
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take,
    include: {
      _count: {
        select: { facts: true, requests: true, risks: true, drafts: true },
      },
    },
  });
}

export async function setCaseStatus(workspaceId: string, caseId: string, status: CaseStatus, userId?: string) {
  await ensureCaseInWorkspace(workspaceId, caseId);
  await prisma.case.update({ where: { id: caseId }, data: { status } });
  await prisma.caseTimelineEvent.create({
    data: {
      caseId,
      kind: CaseTimelineKind.STATUS_CHANGED,
      message: `Status atualizado para ${status}`,
      ...(userId ? { userId } : {}),
    },
  });
}

export async function appendTimelineEvent(args: {
  workspaceId: string;
  caseId: string;
  kind: CaseTimelineKind;
  message: string;
  payloadJson?: Record<string, unknown>;
  retrievalChunkIds?: string[];
  traceId?: string;
  userId?: string;
}) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  return prisma.caseTimelineEvent.create({
    data: {
      caseId: args.caseId,
      kind: args.kind,
      message: args.message,
      ...(args.payloadJson ? { payloadJson: args.payloadJson as Prisma.InputJsonValue } : {}),
      ...(args.retrievalChunkIds?.length ? { retrievalChunkIds: args.retrievalChunkIds } : {}),
      ...(args.traceId ? { traceId: args.traceId } : {}),
      ...(args.userId ? { userId: args.userId } : {}),
    },
  });
}

export async function persistDraft(args: {
  workspaceId: string;
  caseId: string;
  content: string;
  groundingChunkIds: string[];
  status?: CaseDraftStatus;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  return prisma.$transaction(async (tx) => {
    const last = await tx.caseDraft.findFirst({
      where: { caseId: args.caseId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    const draft = await tx.caseDraft.create({
      data: {
        caseId: args.caseId,
        version,
        status: args.status ?? CaseDraftStatus.GENERATED,
        content: args.content,
        groundingChunkIds: args.groundingChunkIds,
        ...(args.metadata ? { metadataJson: args.metadata as Prisma.InputJsonValue } : {}),
      },
    });
    await tx.caseTimelineEvent.create({
      data: {
        caseId: args.caseId,
        kind: CaseTimelineKind.DRAFT_GENERATED,
        message: `Minuta v${version} gerada (${args.groundingChunkIds.length} fontes)` ,
        retrievalChunkIds: args.groundingChunkIds,
        ...(args.userId ? { userId: args.userId } : {}),
      },
    });
    return draft;
  });
}

export async function persistReview(args: {
  workspaceId: string;
  caseId: string;
  score: number;
  verdict: string;
  checklist: Array<Record<string, unknown>>;
  riskIds?: string[];
  userId?: string;
}) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  return prisma.$transaction(async (tx) => {
    const review = await tx.caseReview.create({
      data: {
        caseId: args.caseId,
        score: args.score,
        verdict: args.verdict,
        checklistJson: args.checklist as unknown as Prisma.InputJsonValue,
        riskIds: args.riskIds ?? [],
      },
    });
    await tx.caseTimelineEvent.create({
      data: {
        caseId: args.caseId,
        kind: CaseTimelineKind.REVIEW_RUN,
        message: `Review concluída: ${args.verdict} (score=${args.score.toFixed(2)})`,
        ...(args.userId ? { userId: args.userId } : {}),
      },
    });
    return review;
  });
}

export async function persistRisks(args: {
  workspaceId: string;
  caseId: string;
  risks: ParsedRisk[];
}) {
  if (!args.risks.length) return [];
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  await prisma.caseRisk.createMany({
    data: args.risks.map((r) => mapRisk(args.caseId, r)),
  });
  await prisma.caseTimelineEvent.create({
    data: {
      caseId: args.caseId,
      kind: CaseTimelineKind.RISK_FLAGGED,
      message: `${args.risks.length} risco(s) sinalizado(s)`,
      payloadJson: { risks: args.risks.map((r) => ({ kind: r.kind, severity: r.severity, title: r.title })) },
    },
  });
  return prisma.caseRisk.findMany({
    where: { caseId: args.caseId },
    orderBy: { createdAt: "desc" },
  });
}

/* ---------------------------- helpers ----------------------------------- */

async function ensureCaseInWorkspace(workspaceId: string, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) {
    const err = new Error("Caso não encontrado neste workspace.");
    (err as { status?: number }).status = 404;
    throw err;
  }
}

function mapFact(caseId: string, f: ParsedFact) {
  const data: Prisma.CaseFactCreateManyInput = {
    caseId,
    ordinal: f.ordinal,
    text: f.text,
    confidence: f.confidence,
    dates: f.dates,
  };
  if (f.category) data.category = f.category;
  return data;
}

function mapParty(caseId: string, p: ParsedParty) {
  const data: Prisma.CasePartyCreateManyInput = {
    caseId,
    role: p.role,
    kind: p.kind,
    name: p.name,
  };
  if (p.document) data.document = p.document;
  if (p.metadataJson) data.metadataJson = p.metadataJson as Prisma.InputJsonValue;
  return data;
}

function mapRequest(caseId: string, r: ParsedRequest) {
  const data: Prisma.CaseRequestCreateManyInput = {
    caseId,
    ordinal: r.ordinal,
    kind: r.kind,
    text: r.text,
  };
  if (r.legalBasisUrn) data.legalBasisUrn = r.legalBasisUrn;
  if (r.metadataJson) data.metadataJson = r.metadataJson as Prisma.InputJsonValue;
  return data;
}

function mapRisk(caseId: string, r: ParsedRisk) {
  const data: Prisma.CaseRiskCreateManyInput = {
    caseId,
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    detail: r.detail,
    evidenceChunkIds: r.evidenceChunkIds,
    evidenceNormUrns: r.evidenceNormUrns,
  };
  return data;
}
