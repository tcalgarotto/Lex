/**
 * POST /api/cases/fundamental-intake
 *
 * - action=save | draft: grava entrevista sem IA (cria caso ou atualiza `caseId`).
 * - action=structure | reorganize: persiste entrevista, depois organiza com Lex AI (opcional).
 *   Caso já organizado exige `reorganize: true` ou `action=reorganize` (sem 409).
 *
 * Save-first: estruturação nunca é pré-requisito para usar o caso.
 * Falha da IA na organização devolve o caso salvo + `structureError` (não bloqueia).
 */

import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  flushLangfuseTraces,
  withLangfuseRouteContext,
} from "@/lib/observability/langfuse-tracing";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/cases/repository";
import { parseFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { isReadyForLexStructure, lexStructureBlockedReason } from "@/components/cases/fundamental-intake-helpers";
import { runDeepseekFundamentalStructure } from "@/lib/cases/fundamental-intake/deepseek-structure";
import { buildIntakeNarrativeForModel } from "@/lib/cases/fundamental-intake/build-narrative";
import {
  applyFundamentalStructure,
  persistFundamentalDraft,
} from "@/lib/cases/fundamental-intake/fundamental-intake-service";
import { assertDeepSeekConfigured } from "@/lib/ai/deepseek-provider";
import { normalizeAiProviderError } from "@/lib/ai/normalize-ai-error";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.cases.fundamental-intake");

const PostBody = z.object({
  action: z.enum(["draft", "save", "structure", "reorganize"]),
  reorganize: z.boolean().optional(),
  caseId: z.string().cuid().optional(),
  form: z.unknown(),
});

function isSaveAction(action: string): boolean {
  return action === "draft" || action === "save";
}

function isStructureAction(action: string): boolean {
  return action === "structure" || action === "reorganize";
}

function wantsReorganize(body: z.infer<typeof PostBody>): boolean {
  return body.reorganize === true || body.action === "reorganize";
}

function revalidateCaseSurface(caseId: string) {
  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}/entrevista`);
  revalidatePath(`/cases/${caseId}/partes-fatos`);
  revalidatePath(`/cases/${caseId}/documentos`);
  revalidatePath(`/cases/${caseId}/pesquisa-juridica`);
  revalidatePath(`/cases/${caseId}/estrategia`);
}

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const parsedForm = parseFundamentalIntakeForm(body.form);
  if (!parsedForm.success) {
    return NextResponse.json(
      { error: "Revise os campos destacados.", issues: parsedForm.error.flatten() },
      { status: 400 },
    );
  }
  const form = parsedForm.data;

  if (isStructureAction(body.action) && !isReadyForLexStructure(form)) {
    return NextResponse.json(
      {
        error:
          lexStructureBlockedReason(form) ??
          "Complete todas as secções obrigatórias antes de organizar com a Lex AI.",
      },
      { status: 400 },
    );
  }

  if (isSaveAction(body.action)) {
    try {
      const { id } = await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId: body.caseId ?? null,
        form,
      });
      const c = await getCaseById(workspaceId, id);
      revalidateCaseSurface(id);
      return NextResponse.json(
        {
          case: c,
          mode: body.action === "save" ? "fundamental_saved" : "fundamental_draft",
        },
        { status: body.caseId ? 200 : 201 },
      );
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      return NextResponse.json({ error: (e as Error).message }, { status });
    }
  }

  let caseId = body.caseId ?? null;
  const narrative = buildIntakeNarrativeForModel(form);

  try {
    const { id } = await persistFundamentalDraft({
      workspaceId,
      userId: user.id,
      caseId,
      form,
    });
    caseId = id;

    const row = await prisma.case.findFirst({
      where: { id: caseId, workspaceId, deletedAt: null },
      select: { metadataJson: true },
    });
    const meta = (row?.metadataJson ?? {}) as Record<string, unknown>;
    if (meta["intakeStructuredAt"] && !wantsReorganize(body)) {
      return NextResponse.json(
        {
          error: "Este caso já foi organizado. Confirme a reorganização para continuar.",
          code: "REORGANIZE_REQUIRED",
        },
        { status: 400 },
      );
    }

    assertDeepSeekConfigured();
    after(async () => {
      await flushLangfuseTraces();
    });

    const structured = await withLangfuseRouteContext(
      {
        traceName: "intake-structuring",
        userId: user.id,
        workspaceId,
        caseId: caseId ?? undefined,
        inputSummary: JSON.stringify({ narrativeLen: narrative.length }),
      },
      () =>
        runDeepseekFundamentalStructure(narrative, {
          workspaceId,
          caseId: caseId ?? undefined,
        }),
    );
    await applyFundamentalStructure({
      workspaceId,
      userId: user.id,
      caseId,
      form,
      structured,
    });

    const c = await getCaseById(workspaceId, caseId);
    if (!c) {
      return NextResponse.json({ error: "Caso não encontrado após organizar." }, { status: 500 });
    }
    revalidateCaseSurface(caseId);
    return NextResponse.json({ case: c, mode: "fundamental_structured" }, { status: 200 });
  } catch (e) {
    const normalized = normalizeAiProviderError(e);

    if (caseId) {
      log.warn("structure_failed_case_saved", {
        caseId,
        code: normalized.code,
        hint: normalized.technicalHint,
      });
      const c = await getCaseById(workspaceId, caseId);
      revalidateCaseSurface(caseId);
      return NextResponse.json(
        {
          case: c,
          mode: "fundamental_saved",
          structureError: normalized.userMessage,
          code: normalized.code,
        },
        { status: 200 },
      );
    }

    log.warn("structure_failed", {
      code: normalized.code,
      hint: normalized.technicalHint,
    });
    const status =
      normalized.code === "missing_api_key"
        ? 503
        : normalized.code === "invalid_json"
          ? 502
          : 502;
    return NextResponse.json(
      { error: normalized.userMessage, code: normalized.code },
      { status },
    );
  }
}
