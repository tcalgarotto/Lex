/**
 * GET  /api/cases  — lista os casos do workspace ativo (paginado básico).
 * POST /api/cases  — cria caso. Suporta 5 modos (F1.5):
 *
 *   - "raw"               — relato livre (default; comportamento original).
 *   - "interview"         — relato vazio + checklist guiado preenchido depois (F2.1).
 *   - "document"          — caso vazio + auto-criação após upload (UI cuida do upload).
 *   - "existing_process"  — vincula a um Process existente (CNJ + tribunal/uf opcional).
 *   - "empty"             — caso minimalista (título; relato preenchido depois).
 *
 * Validação Zod: `processNumber`/`tribunalCode`/`uf` SÓ são obrigatórios em
 * `mode="existing_process"` (ou quando `markedAsFiled=true`). Para os demais
 * modos, esses campos são rejeitados — assim a UI não tenta forçar caso pré-
 * processual a parecer judicial.
 *
 * Auth: requer sessão + workspace ativo.
 * Multi-tenant: tudo escopado por workspaceId.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseStatus, CaseTimelineKind, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listCases } from "@/lib/cases/repository";
import { intakeWorkflow } from "@/lib/cases/orchestrator";
import { inngest } from "@/lib/inngest/client";
import { fireLexJustosEventForCase } from "@/lib/justos";


const RawSchema = z.object({
  mode: z.literal("raw").optional(),
  rawInput: z.string().min(20, "Descreva o caso com pelo menos 20 caracteres.").max(50_000),
  // Campos judiciais não permitidos em pré-processual.
  processNumber: z.never().optional(),
  tribunalCode: z.never().optional(),
  uf: z.never().optional(),
  processId: z.never().optional(),
});

const InterviewSchema = z.object({
  mode: z.literal("interview"),
  title: z.string().min(2).max(200).optional(),
  templateId: z.string().min(2).max(120).optional(),
  processNumber: z.never().optional(),
  tribunalCode: z.never().optional(),
  uf: z.never().optional(),
});

const DocumentSchema = z.object({
  mode: z.literal("document"),
  title: z.string().min(2).max(200).optional(),
  documentId: z.string().cuid().optional(),
  processNumber: z.never().optional(),
  tribunalCode: z.never().optional(),
  uf: z.never().optional(),
});

const ExistingProcessSchema = z.object({
  mode: z.literal("existing_process"),
  title: z.string().min(2).max(200),
  processNumber: z
    .string()
    .min(20, "Informe um CNJ válido (20 dígitos).")
    .max(40)
    .regex(/[\d.\-/]+/, "CNJ inválido.")
    .refine((s) => s.replace(/\D/g, "").length === 20, "CNJ inválido (20 dígitos)."),
  tribunalCode: z.string().min(2).max(20).optional(),
  uf: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  processId: z.string().cuid().optional(),
  rawInput: z.string().max(50_000).optional(),
});

const EmptySchema = z.object({
  mode: z.literal("empty"),
  title: z.string().min(2).max(200),
  processNumber: z.never().optional(),
  tribunalCode: z.never().optional(),
  uf: z.never().optional(),
});

function notifyCaseCreated(workspaceId: string, caseId: string, title?: string) {
  fireLexJustosEventForCase({
    event: "lex.case.created",
    workspaceId,
    caseId,
    title,
  });
}

const PostBody = z.union([
  RawSchema,
  InterviewSchema,
  DocumentSchema,
  ExistingProcessSchema,
  EmptySchema,
]);

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim() || null;
  const hasProcessParam = url.searchParams.get("hasProcess");
  const hasDocsParam = url.searchParams.get("hasDocuments");
  const hasDraftsParam = url.searchParams.get("hasDrafts");
  const includeArchived = url.searchParams.get("archived") === "1";

  const parseBool = (v: string | null): boolean | null => {
    if (v === null) return null;
    if (v === "1" || v.toLowerCase() === "true") return true;
    if (v === "0" || v.toLowerCase() === "false") return false;
    return null;
  };

  const status = statusParam && Object.values(CaseStatus).includes(statusParam as CaseStatus)
    ? (statusParam as CaseStatus)
    : null;
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") ?? "20")));
  const cases = await listCases(workspaceId, {
    take,
    status,
    q,
    hasProcess: parseBool(hasProcessParam),
    hasDocuments: parseBool(hasDocsParam),
    hasDrafts: parseBool(hasDraftsParam),
    includeArchived,
  });
  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
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

  // mode "raw" (default) — comportamento original.
  if (!("mode" in body) || body.mode === "raw" || body.mode === undefined) {
    const { case: c, intake } = await intakeWorkflow({
      workspaceId,
      userId: user.id,
      rawInput: (body as z.infer<typeof RawSchema>).rawInput,
    });
    // F2: dispara consolidação assíncrona do Brain (LLM-first).
    // Best-effort — não falha a request se Inngest estiver indisponível.
    try {
      await inngest.send({
        name: "lex/case.brain",
        data: { caseId: c.id, source: "create" },
      });
    } catch {
      /* noop */
    }
    notifyCaseCreated(workspaceId, c.id, c.title);
    return NextResponse.json({ case: c, intake, mode: "raw" }, { status: 201 });
  }

  // Outros modos criam caso minimalista direto (sem rodar intakeWorkflow,
  // que exige rawInput e roda regex). Brain consolida depois (F2).
  switch (body.mode) {
    case "interview": {
      const c = await prisma.$transaction(async (tx) => {
        const created = await tx.case.create({
          data: {
            workspaceId,
            createdById: user.id,
            title: body.title ?? "Novo caso (entrevista guiada)",
            summary: null,
            rawInput: "",
            status: CaseStatus.INTAKE,
            metadataJson: body.templateId
              ? ({ checklistTemplateId: body.templateId } as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        });
        await tx.caseTimelineEvent.create({
          data: {
            caseId: created.id,
            kind: CaseTimelineKind.CASE_CREATED,
            message: `Caso criado em modo entrevista guiada${body.templateId ? ` (${body.templateId})` : ""}`,
            userId: user.id,
          },
        });
        return created;
      });
      notifyCaseCreated(workspaceId, c.id, c.title);
      return NextResponse.json({ case: c, mode: "interview" }, { status: 201 });
    }

    case "document": {
      // Valida documento se passado (precisa pertencer ao workspace).
      if (body.documentId) {
        const doc = await prisma.document.findFirst({
          where: { id: body.documentId, workspaceId },
          select: { id: true, originalName: true, caseId: true },
        });
        if (!doc) {
          return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
        }
        if (doc.caseId) {
          return NextResponse.json(
            { error: "Documento já vinculado a outro caso" },
            { status: 409 },
          );
        }
      }
      const c = await prisma.$transaction(async (tx) => {
        const created = await tx.case.create({
          data: {
            workspaceId,
            createdById: user.id,
            title: body.title ?? "Novo caso (a partir de documento)",
            summary: null,
            rawInput: "",
            status: CaseStatus.INTAKE,
          },
        });
        if (body.documentId) {
          await tx.document.update({
            where: { id: body.documentId, workspaceId },
            data: { caseId: created.id },
          });
        }
        await tx.caseTimelineEvent.create({
          data: {
            caseId: created.id,
            kind: CaseTimelineKind.CASE_CREATED,
            message: `Caso criado a partir de documento${body.documentId ? ` (${body.documentId})` : ""}`,
            userId: user.id,
          },
        });
        return created;
      });
      notifyCaseCreated(workspaceId, c.id, c.title);
      return NextResponse.json({ case: c, mode: "document" }, { status: 201 });
    }

    case "existing_process": {
      // Verifica se Process já existe (opcional). Se body.processId vier,
      // garantimos que é do workspace e que ainda não foi vinculado.
      if (body.processId) {
        const proc = await prisma.process.findFirst({
          where: { id: body.processId, workspaceId },
          include: { case: { select: { id: true } } },
        });
        if (!proc) {
          return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
        }
        if (proc.case) {
          return NextResponse.json(
            { error: "Processo já vinculado a um caso" },
            { status: 409 },
          );
        }
      }

      const c = await prisma.$transaction(async (tx) => {
        const data: Prisma.CaseCreateInput = {
          workspace: { connect: { id: workspaceId } },
          createdById: user.id,
          title: body.title,
          summary: null,
          rawInput: body.rawInput ?? "",
          status: CaseStatus.RESEARCH,
          processNumber: body.processNumber,
          ...(body.tribunalCode ? { tribunalCode: body.tribunalCode } : {}),
          ...(body.uf ? { uf: body.uf } : {}),
          ...(body.processId ? { process: { connect: { id: body.processId } } } : {}),
        };
        const created = await tx.case.create({ data });
        await tx.caseTimelineEvent.create({
          data: {
            caseId: created.id,
            kind: CaseTimelineKind.CASE_CREATED,
            message: `Caso criado com processo existente: ${body.processNumber}`,
            userId: user.id,
            payloadJson: {
              mode: "existing_process",
              processNumber: body.processNumber,
              tribunalCode: body.tribunalCode ?? null,
              uf: body.uf ?? null,
              processId: body.processId ?? null,
            },
          },
        });
        return created;
      });
      // F2: se o usuário já forneceu narrativa, consolida o brain.
      if ((body.rawInput ?? "").trim().length >= 20) {
        try {
          await inngest.send({
            name: "lex/case.brain",
            data: { caseId: c.id, source: "create" },
          });
        } catch {
          /* noop */
        }
      }
      notifyCaseCreated(workspaceId, c.id, c.title);
      return NextResponse.json({ case: c, mode: "existing_process" }, { status: 201 });
    }

    case "empty": {
      const c = await prisma.$transaction(async (tx) => {
        const created = await tx.case.create({
          data: {
            workspaceId,
            createdById: user.id,
            title: body.title,
            summary: null,
            rawInput: "",
            status: CaseStatus.INTAKE,
          },
        });
        await tx.caseTimelineEvent.create({
          data: {
            caseId: created.id,
            kind: CaseTimelineKind.CASE_CREATED,
            message: `Caso criado em modo vazio (preenchimento manual)`,
            userId: user.id,
          },
        });
        return created;
      });
      notifyCaseCreated(workspaceId, c.id, c.title);
      return NextResponse.json({ case: c, mode: "empty" }, { status: 201 });
    }
  }
}
