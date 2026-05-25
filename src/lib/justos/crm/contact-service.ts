import { Prisma, type CrmContact } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCaseInWorkspace, assertClientInWorkspace, CrmNotFoundError } from "./permissions";
import { normalizeCrmPhoneE164 } from "./phone";
import type { CreateCrmContactInput, ListCrmContactsFilters, UpdateCrmContactInput } from "./types";

function activeContactWhere(workspaceId: string): Prisma.CrmContactWhereInput {
  return { workspaceId, deletedAt: null };
}

export async function createCrmContact(args: {
  workspaceId: string;
  data: CreateCrmContactInput;
}): Promise<CrmContact> {
  const phoneE164 = normalizeCrmPhoneE164(args.data.phoneE164 ?? null);
  if (args.data.clientId) await assertClientInWorkspace(args.workspaceId, args.data.clientId);
  if (args.data.caseId) await assertCaseInWorkspace(args.workspaceId, args.data.caseId);

  try {
    return await prisma.crmContact.create({
      data: {
        workspaceId: args.workspaceId,
        kind: args.data.kind ?? "CLIENT",
        displayName: args.data.displayName.trim(),
        phoneE164,
        email: args.data.email?.trim() || null,
        documentId: args.data.documentId?.trim() || null,
        pipelineStage: args.data.pipelineStage ?? "NEW",
        clientId: args.data.clientId ?? null,
        caseId: args.data.caseId ?? null,
        optOutWhatsapp: args.data.optOutWhatsapp ?? false,
        metadataJson: (args.data.metadataJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Já existe um contato com este telefone neste escritório.");
    }
    throw e;
  }
}

export async function getCrmContact(args: {
  workspaceId: string;
  contactId: string;
}): Promise<CrmContact> {
  const row = await prisma.crmContact.findFirst({
    where: { id: args.contactId, ...activeContactWhere(args.workspaceId) },
  });
  if (!row) throw new CrmNotFoundError();
  return row;
}

export async function listCrmContacts(args: {
  workspaceId: string;
  filters?: ListCrmContactsFilters;
}): Promise<{ items: CrmContact[]; nextCursor: string | null }> {
  const f = args.filters ?? {};
  const limit = f.limit ?? 50;
  const where: Prisma.CrmContactWhereInput = f.includeDeleted
    ? { workspaceId: args.workspaceId }
    : activeContactWhere(args.workspaceId);

  if (f.kind) where.kind = f.kind;
  if (f.pipelineStage) where.pipelineStage = f.pipelineStage;
  if (f.caseId) where.caseId = f.caseId;
  if (f.search?.trim()) {
    const q = f.search.trim();
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phoneE164: { contains: q.replace(/\D/g, "") } },
    ];
  }

  const items = await prisma.crmContact.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const last = items.pop()!;
    nextCursor = last.id;
  }

  return { items, nextCursor };
}

export async function updateCrmContact(args: {
  workspaceId: string;
  contactId: string;
  data: UpdateCrmContactInput;
}): Promise<CrmContact> {
  await getCrmContact(args);
  const phoneE164 =
    args.data.phoneE164 !== undefined
      ? normalizeCrmPhoneE164(args.data.phoneE164)
      : undefined;
  if (args.data.clientId) await assertClientInWorkspace(args.workspaceId, args.data.clientId);
  if (args.data.caseId) await assertCaseInWorkspace(args.workspaceId, args.data.caseId);

  try {
    return await prisma.crmContact.update({
      where: { id: args.contactId },
      data: {
        ...(args.data.kind !== undefined ? { kind: args.data.kind } : {}),
        ...(args.data.displayName !== undefined
          ? { displayName: args.data.displayName.trim() }
          : {}),
        ...(phoneE164 !== undefined ? { phoneE164 } : {}),
        ...(args.data.email !== undefined ? { email: args.data.email?.trim() || null } : {}),
        ...(args.data.documentId !== undefined
          ? { documentId: args.data.documentId?.trim() || null }
          : {}),
        ...(args.data.pipelineStage !== undefined
          ? { pipelineStage: args.data.pipelineStage }
          : {}),
        ...(args.data.clientId !== undefined ? { clientId: args.data.clientId } : {}),
        ...(args.data.caseId !== undefined ? { caseId: args.data.caseId } : {}),
        ...(args.data.optOutWhatsapp !== undefined
          ? { optOutWhatsapp: args.data.optOutWhatsapp }
          : {}),
        ...(args.data.metadataJson !== undefined
          ? { metadataJson: args.data.metadataJson as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Já existe um contato com este telefone neste escritório.");
    }
    throw e;
  }
}

export async function softDeleteCrmContact(args: {
  workspaceId: string;
  contactId: string;
}): Promise<void> {
  await getCrmContact(args);
  await prisma.crmContact.update({
    where: { id: args.contactId },
    data: { deletedAt: new Date() },
  });
}

export async function changeCrmStage(args: {
  workspaceId: string;
  contactId: string;
  stage: CrmContact["pipelineStage"];
  createdByUserId?: string;
}): Promise<CrmContact> {
  const prev = await getCrmContact({ workspaceId: args.workspaceId, contactId: args.contactId });
  const contact = await updateCrmContact({
    workspaceId: args.workspaceId,
    contactId: args.contactId,
    data: { pipelineStage: args.stage },
  });
  if (prev.pipelineStage !== args.stage) {
    const { recordCrmActivity } = await import("./timeline-service");
    void recordCrmActivity(args.workspaceId, args.contactId, {
      type: "STAGE_CHANGE",
      title: `Estágio: ${prev.pipelineStage} → ${args.stage}`,
      caseId: contact.caseId,
      createdByUserId: args.createdByUserId,
      metadataJson: { from: prev.pipelineStage, to: args.stage },
    }).catch(() => {});
  }
  return contact;
}
