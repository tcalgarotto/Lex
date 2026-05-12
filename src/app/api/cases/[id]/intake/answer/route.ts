/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { mergeInterviewExtractIntoCase } from "@/lib/cases/case-brain/interview-extraction";
import { mergeCaseMetadataJson } from "@/lib/cases/case-brain/case-metadata-merge";
import {
  computeMissingFields,
  resolveInterviewTemplate,
} from "@/lib/cases/case-brain/intake-checklist-helpers";

const Body = z.object({
  templateId: z.string().min(2).max(120),
  fieldId: z.string().min(1).max(200).optional(),
  /** Valor da resposta (texto principal da entrevista). */
  value: z.union([z.string(), z.number(), z.boolean()]),
  /** Quando true, mescla também em `metadataJson.brain.checklistResponses`. */
  mergeChecklist: z.boolean().optional().default(true),
});


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId } = await params;

  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const answerText =
    typeof body.value === "string" ? body.value : JSON.stringify(body.value);

  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { metadataJson: true },
  });
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const template = await resolveInterviewTemplate(workspaceId, body.templateId);
  if (body.mergeChecklist && template) {
    const previousBrain = (meta["brain"] as Record<string, unknown>) ?? {};
    const previousChecklist = previousBrain["checklistResponses"] as
      | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string }
      | undefined;
    const mergedAnswers = {
      ...(previousChecklist?.templateId === body.templateId ? previousChecklist.answers : {}),
      ...(body.fieldId ? { [body.fieldId]: body.value } : { lastAnswer: body.value }),
    };
    const updatedBrain = {
      ...previousBrain,
      checklistResponses: {
        templateId: body.templateId,
        version: template.version,
        answers: mergedAnswers,
        answeredAt: new Date().toISOString(),
      },
    };
    const updatedMeta = mergeCaseMetadataJson(meta, { brain: updatedBrain });
    await prisma.case.update({
      where: { id: caseId },
      data: { metadataJson: updatedMeta as Prisma.InputJsonValue },
    });
    const missingFields = computeMissingFields(template, mergedAnswers);
    await prisma.caseTimelineEvent.create({
      data: {
        caseId,
        kind: CaseTimelineKind.INTAKE_COMPLETED,
        message: `Entrevista: resposta registrada${body.fieldId ? ` (${body.fieldId})` : ""}.`,
        userId: user.id,
        payloadJson: {
          templateId: body.templateId,
          missingCount: missingFields.length,
        },
      },
    });
  }

  const extract = await mergeInterviewExtractIntoCase({
    workspaceId,
    caseId,
    userId: user.id,
    input: { answerText, fieldId: body.fieldId },
  });

  try {
    await inngest.send({
      name: "lex/case.brain",
      data: { caseId, source: "intake_answer" },
    });
  } catch {
    /* noop */
  }

  return NextResponse.json({
    ok: true,
    extraction: extract,
    checklist: body.mergeChecklist
      ? {
          templateId: body.templateId,
          templateLabel: template?.label ?? body.templateId,
        }
      : null,
  });
}
