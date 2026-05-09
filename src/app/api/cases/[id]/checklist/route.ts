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
import type { ChecklistTemplate } from "@/lib/cases/checklists/registry";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  templateId: z.string().min(2).max(120),
  answers: z.record(z.unknown()),
});

async function resolveTemplate(workspaceId: string, templateId: string) {
  // 1) templates estáticos (registry.ts)
  const staticTpl = getChecklistTemplate(templateId);
  if (staticTpl) return staticTpl;

  // 2) templates do banco (F6)
  const tpl = await prisma.interviewTemplate.findFirst({
    where: { id: templateId, workspaceId },
    select: { id: true, title: true, schemaJson: true, updatedAt: true },
  });
  if (!tpl) return null;

  // Esperamos que `schemaJson` seja compatível com `ChecklistTemplate`.
  // Se estiver malformado, retornamos null (sem quebrar a UX).
  if (!tpl.schemaJson || typeof tpl.schemaJson !== "object") return null;
  const schema = tpl.schemaJson as Record<string, unknown>;
  if (!Array.isArray(schema["sections"])) return null;
  if (!Array.isArray(schema["area"])) return null;
  if (!Array.isArray(schema["triggers"])) return null;

  const labelFromSchema = typeof schema["label"] === "string" ? (schema["label"] as string) : null;
  const versionFromSchema = typeof schema["version"] === "number" ? (schema["version"] as number) : null;

  const normalized: ChecklistTemplate = {
    ...(tpl.schemaJson as ChecklistTemplate),
    id: tpl.id,
    label: labelFromSchema ?? tpl.title,
    version: versionFromSchema ?? Math.max(1, Math.floor(tpl.updatedAt.getTime() / 1000)),
  };

  return normalized;
}

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

  let template = explicitTemplateId ? await resolveTemplate(workspaceId, explicitTemplateId) : null;
  let suggested = false;
  if (!template) {
    const areas = Array.isArray(brain["area"]) ? (brain["area"] as string[]) : [];
    template = suggestChecklistTemplate({ rawText: c.rawInput, brainAreas: areas });
    suggested = !!template;
  }
  // F2.1 — template genérico offline sempre disponível como fallback.
  if (!template) {
    template = getChecklistTemplate("generic.offline.intake");
    suggested = false;
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

  const template = await resolveTemplate(workspaceId, body.templateId);
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
