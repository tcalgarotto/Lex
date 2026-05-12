import { NextResponse } from "next/server";
import { DocumentLibraryShelf } from "@prisma/client";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.documents.link-case");

/**
 * Vincula (ou desvincula) um documento a um Case do mesmo workspace.
 *
 * Body: `{ caseId: string | null }`. `caseId === null` desvincula.
 *
 * Segurança:
 *  - Documento e Case precisam pertencer ao mesmo workspace do usuário.
 *  - Se um deles falha na validação, retornamos 404 sem revelar qual.
 */
const bodySchema = z.object({
  caseId: z.string().min(1).nullable(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId } = await getWorkspaceContext();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { caseId } = parsed.data;

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId },
    select: { id: true, originalName: true, caseId: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  if (caseId) {
    const target = await prisma.case.findFirst({
      where: { id: caseId, workspaceId },
      select: { id: true, title: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      caseId,
      ...(caseId ? { libraryShelf: DocumentLibraryShelf.OFFICE_PRIVATE } : {}),
    },
    select: { id: true, caseId: true },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: caseId ? "document.linked_to_case" : "document.unlinked_from_case",
      title: caseId
        ? `Documento "${doc.originalName}" vinculado ao caso`
        : `Documento "${doc.originalName}" desvinculado do caso`,
      metaJson: {
        documentId: doc.id,
        caseId: caseId ?? null,
        previousCaseId: doc.caseId ?? null,
      },
    },
  });

  if (caseId) {
    await prisma.caseTimelineEvent
      .create({
        data: {
          caseId,
          kind: "NOTE",
          message: `Documento "${doc.originalName}" vinculado ao caso.`,
          payloadJson: { documentId: doc.id, action: "document.linked" },
        },
      })
      .catch((err) => {
        log.warn("timeline event failed (non-fatal)", {
          workspaceId,
          caseId,
          documentId: doc.id,
          err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
        });
      });
  }

  return NextResponse.json({ ok: true, document: updated });
}
