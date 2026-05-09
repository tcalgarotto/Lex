"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MemoryKind } from "@prisma/client";
import { getWorkspaceContext, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

export async function createProcessAction(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const number = String(formData.get("number") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const vara = String(formData.get("vara") ?? "").trim() || null;
  const tribunal = String(formData.get("tribunal") ?? "").trim() || null;
  const observations = String(formData.get("observations") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  if (!number) throw new Error("Número do processo obrigatório");

  const proc = await prisma.process.create({
    data: {
      workspaceId,
      number,
      title,
      vara,
      tribunal,
      observations,
      tags,
    },
  });

  await prisma.processTimelineEvent.create({
    data: {
      processId: proc.id,
      title: "Processo cadastrado",
      description: "Registro criado no Lex.",
    },
  });

  await prisma.chatThread.create({
    data: {
      workspaceId,
      processId: proc.id,
      title: "Chat contextual",
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "process.created",
      title: `Novo processo ${number}`,
      metaJson: { processId: proc.id },
    },
  });

  revalidatePath("/processos");
  revalidatePath("/dashboard");
  return proc.id;
}

export async function createProcessAndRedirect(formData: FormData) {
  const id = await createProcessAction(formData);
  redirect(`/processos/${id}`);
}

export async function triggerStyleRecomputeAction() {
  const { workspaceId, user } = await getWorkspaceContext();
  await inngest.send({
    name: "lex/style.recompute",
    data: { workspaceId, userId: user.id },
  });
  revalidatePath("/settings/estilo");
}

export async function triggerCorpusReindexAction() {
  await requirePermission("observabilityView");
  await inngest.send({ name: "lex/corpus.reindex", data: {} });
}

export async function createLegalPieceAction(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const processId = String(formData.get("processId") ?? "");
  const kind = String(formData.get("kind") ?? "peticao");
  const title = String(formData.get("title") ?? "Nova peça").trim();

  const piece = await prisma.legalPiece.create({
    data: {
      workspaceId,
      processId: processId || null,
      kind,
      title,
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "" }],
          },
        ],
      },
    },
  });

  try {
    await inngest.send({
      name: "lex/style.recompute",
      data: { workspaceId, userId: null },
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/processos/${processId}`);
  revalidatePath(`/editor/${piece.id}`);
  return piece.id;
}

export async function createLegalPieceAndRedirect(formData: FormData) {
  const id = await createLegalPieceAction(formData);
  redirect(`/editor/${id}`);
}

export async function createMemoryEntryAction(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const processId = String(formData.get("processId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "STRATEGY");
  const kind = Object.values(MemoryKind).includes(kindRaw as MemoryKind)
    ? (kindRaw as MemoryKind)
    : MemoryKind.STRATEGY;
  const title = String(formData.get("title") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Conteúdo obrigatório");

  await prisma.memoryEntry.create({
    data: {
      workspaceId,
      processId: processId || null,
      kind,
      title,
      content,
    },
  });
  revalidatePath(`/processos/${processId}`);
}

export async function addTimelineEventAction(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const processId = String(formData.get("processId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!processId || !title) throw new Error("Dados incompletos");

  const proc = await prisma.process.findFirst({ where: { id: processId, workspaceId } });
  if (!proc) throw new Error("Processo não encontrado");

  await prisma.processTimelineEvent.create({
    data: { processId, title, description },
  });
  revalidatePath(`/processos/${processId}`);
}
