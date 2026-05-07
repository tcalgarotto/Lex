/**
 * Collaborative intelligence sobre casos: comentários, anotações,
 * pedidos de revisão e aprovação de minutas.
 *
 * Multi-tenant: toda operação confirma que o caso pertence ao workspaceId.
 * Cria entradas na timeline + notificações automáticas (knowledge sharing).
 */

import {
  CaseCommentVisibility,
  CaseAnnotationKind,
  CaseTimelineKind,
  DraftApprovalStatus,
  NotificationKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function ensureCaseInWorkspace(workspaceId: string, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { workspaceId, id: caseId },
    select: { id: true },
  });
  if (!c) {
    const e = new Error("Caso não encontrado neste workspace.");
    (e as { status?: number }).status = 404;
    throw e;
  }
}

export type AddCommentArgs = {
  workspaceId: string;
  caseId: string;
  authorId: string;
  body: string;
  draftId?: string | null;
  visibility?: CaseCommentVisibility;
  refChunkIds?: string[];
};

export async function addComment(args: AddCommentArgs) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  const body = args.body.trim();
  if (body.length < 1 || body.length > 8_000) {
    const e = new Error("Comentário precisa ter entre 1 e 8000 caracteres.");
    (e as { status?: number }).status = 400;
    throw e;
  }
  const created = await prisma.caseComment.create({
    data: {
      caseId: args.caseId,
      authorId: args.authorId,
      ...(args.draftId ? { draftId: args.draftId } : {}),
      body,
      visibility: args.visibility ?? CaseCommentVisibility.WORKSPACE,
      refChunkIds: args.refChunkIds ?? [],
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId: args.caseId,
      kind: CaseTimelineKind.NOTE,
      message: "Comentário adicionado por advogado",
      userId: args.authorId,
      payloadJson: { commentId: created.id, draftId: args.draftId ?? null },
    },
  });

  if (created.visibility === CaseCommentVisibility.WORKSPACE) {
    await prisma.notification.create({
      data: {
        workspaceId: args.workspaceId,
        kind: NotificationKind.COMMENT,
        title: "Novo comentário em um caso",
        body: body.slice(0, 280),
        href: `/cases/${args.caseId}`,
        refIds: [args.caseId, created.id],
      },
    });
  }

  return created;
}

export async function listComments(args: { workspaceId: string; caseId: string }) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  return prisma.caseComment.findMany({
    where: { caseId: args.caseId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function resolveComment(args: {
  workspaceId: string;
  caseId: string;
  commentId: string;
}) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  return prisma.caseComment.updateMany({
    where: { id: args.commentId, caseId: args.caseId, resolved: false },
    data: { resolved: true, resolvedAt: new Date() },
  });
}

export type AddAnnotationArgs = {
  workspaceId: string;
  caseId: string;
  authorId: string;
  draftId?: string | null;
  kind?: CaseAnnotationKind;
  startOffset: number;
  endOffset: number;
  excerpt: string;
  note?: string | null;
};

export async function addAnnotation(args: AddAnnotationArgs) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  if (args.endOffset <= args.startOffset) {
    const e = new Error("Anotação inválida: endOffset deve ser > startOffset.");
    (e as { status?: number }).status = 400;
    throw e;
  }
  if (args.excerpt.length === 0 || args.excerpt.length > 4_000) {
    const e = new Error("Trecho da anotação inválido.");
    (e as { status?: number }).status = 400;
    throw e;
  }
  const created = await prisma.caseAnnotation.create({
    data: {
      caseId: args.caseId,
      authorId: args.authorId,
      ...(args.draftId ? { draftId: args.draftId } : {}),
      kind: args.kind ?? CaseAnnotationKind.HIGHLIGHT,
      startOffset: args.startOffset,
      endOffset: args.endOffset,
      excerpt: args.excerpt,
      ...(args.note ? { note: args.note } : {}),
    },
  });
  return created;
}

export async function listAnnotations(args: {
  workspaceId: string;
  caseId: string;
  draftId?: string | null;
}) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  const where: Prisma.CaseAnnotationWhereInput = { caseId: args.caseId };
  if (args.draftId !== undefined && args.draftId !== null) where.draftId = args.draftId;
  return prisma.caseAnnotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type RequestApprovalArgs = {
  workspaceId: string;
  caseId: string;
  draftId: string;
  requestedBy: string;
  reviewerId?: string | null;
  rationale?: string | null;
};

export async function requestApproval(args: RequestApprovalArgs) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  const draft = await prisma.caseDraft.findFirst({
    where: { id: args.draftId, caseId: args.caseId },
    select: { id: true, version: true },
  });
  if (!draft) {
    const e = new Error("Minuta não encontrada para este caso.");
    (e as { status?: number }).status = 404;
    throw e;
  }
  const created = await prisma.draftApproval.create({
    data: {
      caseId: args.caseId,
      draftId: args.draftId,
      requestedBy: args.requestedBy,
      ...(args.reviewerId ? { reviewerId: args.reviewerId } : {}),
      ...(args.rationale ? { rationale: args.rationale } : {}),
      status: DraftApprovalStatus.REQUESTED,
    },
  });
  await prisma.caseTimelineEvent.create({
    data: {
      caseId: args.caseId,
      kind: CaseTimelineKind.STATUS_CHANGED,
      message: `Aprovação solicitada para minuta v${draft.version}`,
      userId: args.requestedBy,
      payloadJson: { approvalId: created.id, draftId: args.draftId },
    },
  });
  await prisma.notification.create({
    data: {
      workspaceId: args.workspaceId,
      kind: NotificationKind.APPROVAL,
      title: "Pedido de aprovação de minuta",
      body: `Minuta v${draft.version} aguardando revisão.`,
      href: `/cases/${args.caseId}`,
      refIds: [args.caseId, args.draftId, created.id],
    },
  });
  return created;
}

export type DecideApprovalArgs = {
  workspaceId: string;
  caseId: string;
  approvalId: string;
  reviewerId: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  rationale?: string | null;
};

export async function decideApproval(args: DecideApprovalArgs) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  const approval = await prisma.draftApproval.findFirst({
    where: {
      id: args.approvalId,
      caseId: args.caseId,
      status: DraftApprovalStatus.REQUESTED,
    },
  });
  if (!approval) {
    const e = new Error("Pedido de aprovação não encontrado ou já decidido.");
    (e as { status?: number }).status = 404;
    throw e;
  }
  const updated = await prisma.draftApproval.update({
    where: { id: approval.id },
    data: {
      reviewerId: args.reviewerId,
      status: DraftApprovalStatus[args.decision],
      ...(args.rationale ? { rationale: args.rationale } : {}),
      decidedAt: new Date(),
    },
  });
  await prisma.caseTimelineEvent.create({
    data: {
      caseId: args.caseId,
      kind: CaseTimelineKind.STATUS_CHANGED,
      message: `Minuta ${args.decision.toLowerCase()} pelo revisor`,
      userId: args.reviewerId,
      payloadJson: { approvalId: approval.id },
    },
  });
  await prisma.notification.create({
    data: {
      workspaceId: args.workspaceId,
      kind: NotificationKind.APPROVAL,
      title: `Minuta: ${args.decision === "APPROVED" ? "aprovada" : args.decision === "REJECTED" ? "rejeitada" : "ajustes solicitados"}`,
      body: args.rationale?.slice(0, 280) ?? "",
      href: `/cases/${args.caseId}`,
      refIds: [args.caseId, approval.draftId, approval.id],
    },
  });
  return updated;
}

export async function listApprovals(args: { workspaceId: string; caseId: string }) {
  await ensureCaseInWorkspace(args.workspaceId, args.caseId);
  return prisma.draftApproval.findMany({
    where: { caseId: args.caseId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
