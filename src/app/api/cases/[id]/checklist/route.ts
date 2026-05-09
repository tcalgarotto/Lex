/**
 * F2.1 — Endpoint do checklist guiado.
 *
 *   GET  /api/cases/[id]/checklist[?templateId=...]
 *        → { template, answers, missingFields, suggestedTemplate }
 *   POST /api/cases/[id]/checklist
 *        body { templateId, answers }
 *        → { savedFields, missingFields, nextBestAction }
 *        + dispara `lex/case.brain` para reconsolidar.
 *
 * Persistência: `Case.metadataJson.brain.checklistResponses` (sem migration).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  computeMissingFields,
  getChecklistTemplate,
  suggestChecklistTemplate,
} from "@/lib/cases/checklists/registry";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  templateId: z.string().min(2).max(120),
  answers: z.record(z.unknown()),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const url = new URL(req.url);
  const qsTemplateId = url.searchParams.get("templateId");

  const c = await prisma.case.findFirst({
    where: { id, workspaceId },
    select: { id: true, rawInput: true, metadataJson: true },
  });
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const brain = (meta["brain"] ?? {}) as Record<string, unknown>;
  const existingResponses = brain["checklistResponses"] as
    | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string }
    | undefined;

  const explicitTemplateId =
    qsTemplateId ??
    existingResponses?.templateId ??
    (typeof meta["checklistTemplateId"] === "string"
      ? (meta["checklistTemplateId"] as string)
      : null);

  let template = explicitTemplateId ? getChecklistTemplate(explicitTemplateId) : null;
  let suggested = false;
  if (!template) {
    const areas = Array.isArray(brain["area"]) ? (brain["area"] as string[]) : [];
    template = suggestChecklistTemplate({ rawText: c.rawInput, brainAreas: areas });
    suggested = !!template;
  }

  const answers = existingResponses?.answers ?? {};
  const missingFields = template ? computeMissingFields(template, answers) : [];

  return NextResponse.json({
    template,
    suggestedTemplate: suggested,
    answers,
    missingFields,
    answeredAt: existingResponses?.answeredAt ?? null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  let body: z.infer<typeof PostBody>;
  try {
    const json = await req.json();
    body = PostBody.parse(json);
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const template = getChecklistTemplate(body.templateId);
  if (!template) {
    return NextResponse.json({ error: "Template de checklist desconhecido" }, { status: 404 });
  }

  const c = await prisma.case.findFirst({
    where: { id, workspaceId },
    select: { id: true, metadataJson: true },
  });
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const previousBrain = (meta["brain"] as Record<string, unknown>) ?? {};
  const previousChecklist = previousBrain["checklistResponses"] as
    | { templateId: string; version: number; answers: Record<string, unknown>; answeredAt: string }
    | undefined;

  const mergedAnswers = {
    ...(previousChecklist?.templateId === body.templateId
      ? previousChecklist.answers
      : {}),
    ...body.answers,
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

  const updatedMeta = { ...meta, brain: updatedBrain };

  await prisma.case.update({
    where: { id: c.id },
    data: { metadataJson: updatedMeta as Prisma.InputJsonValue },
  });

  const missingFields = computeMissingFields(template, mergedAnswers);
  const savedFieldIds = Object.keys(body.answers);
  const nextBestAction = missingFields[0]
    ? `Pergunte à cliente: ${missingFields[0].label}.`
    : "Checklist completo. Reconsolidando inteligência do caso.";

  await prisma.caseTimelineEvent.create({
    data: {
      caseId: c.id,
      kind: CaseTimelineKind.INTAKE_COMPLETED,
      message: `Checklist '${template.label}' atualizado (${savedFieldIds.length} campos)`,
      userId: user.id,
      payloadJson: {
        templateId: template.id,
        version: template.version,
        savedFields: savedFieldIds.slice(0, 50),
        missingCount: missingFields.length,
      },
    },
  });

  // F2: dispara reconsolidação (best-effort).
  try {
    await inngest.send({
      name: "lex/case.brain",
      data: { caseId: c.id, source: "checklist" },
    });
  } catch {
    /* noop */
  }

  return NextResponse.json({
    savedFields: savedFieldIds,
    missingFields: missingFields.map((f) => ({ id: f.id, label: f.label, sectionTitle: undefined })),
    nextBestAction,
  });
}
