/**
 * POST /api/cases/[id]/mark-filed
 *
 * Marca um caso pré-processual como protocolado, vinculando os campos
 * judiciais (CNJ + tribunal/uf, opcionalmente um Process existente).
 *
 * Idempotente: se o caso já tiver `processNumber` e o body bater, apenas
 * registra novo evento na timeline.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseStatus, CaseTimelineKind } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";


const Body = z.object({
  processNumber: z
    .string()
    .min(15, "Informe um CNJ válido.")
    .max(40)
    .regex(/[\d.\-/]+/, "CNJ inválido."),
  tribunalCode: z.string().min(2).max(20).optional(),
  uf: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  processId: z.string().cuid().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  let body: z.infer<typeof Body>;
  try {
    const json = await req.json();
    body = Body.parse(json);
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const c = await prisma.case.findFirst({
    where: { id, workspaceId },
    select: { id: true, processId: true, processNumber: true, status: true },
  });
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  if (body.processId) {
    const proc = await prisma.process.findFirst({
      where: { id: body.processId, workspaceId },
      include: { case: { select: { id: true } } },
    });
    if (!proc) {
      return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    }
    if (proc.case && proc.case.id !== c.id) {
      return NextResponse.json(
        { error: "Processo já vinculado a outro caso" },
        { status: 409 },
      );
    }
  }

  await prisma.case.update({
    where: { id: c.id },
    data: {
      processNumber: body.processNumber,
      ...(body.tribunalCode ? { tribunalCode: body.tribunalCode } : {}),
      ...(body.uf ? { uf: body.uf } : {}),
      ...(body.processId ? { processId: body.processId } : {}),
      status:
        c.status === CaseStatus.INTAKE || c.status === CaseStatus.RESEARCH
          ? CaseStatus.FILED
          : c.status,
    },
  });

  await prisma.caseTimelineEvent.create({
    data: {
      caseId: c.id,
      kind: CaseTimelineKind.STATUS_CHANGED,
      message: `Caso marcado como protocolado (CNJ ${body.processNumber})`,
      userId: user.id,
      payloadJson: {
        action: "case.mark_filed",
        processNumber: body.processNumber,
        tribunalCode: body.tribunalCode ?? null,
        uf: body.uf ?? null,
        processId: body.processId ?? null,
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
