/**
 * POST /api/cases/fundamental-intake
 *
 * - action=draft: grava rascunho (cria caso ou atualiza `caseId`).
 * - action=structure: chama DeepSeek, grava caso (se novo), materializa partes/fatos/pedidos/riscos/brain.
 *
 * Novo caso sem `caseId`: a IA corre **antes** de criar o registo — falha na estruturação não deixa caso órfão.
 * Não dispara consolidação Inngest (fluxo principal DeepSeek + Postgres).
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  action: z.enum(["draft", "structure"]),
  caseId: z.string().cuid().optional(),
  form: z.unknown(),
});

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

  if (body.action === "structure" && !isReadyForLexStructure(form)) {
    return NextResponse.json(
      {
        error:
          lexStructureBlockedReason(form) ??
          "Complete todas as secções obrigatórias antes de estruturar com a Lex AI.",
      },
      { status: 400 },
    );
  }

  if (body.action === "draft") {
    try {
      const { id } = await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId: body.caseId ?? null,
        form,
      });
      const c = await getCaseById(workspaceId, id);
      revalidateCaseSurface(id);
      return NextResponse.json({ case: c, mode: "fundamental_draft" }, { status: body.caseId ? 200 : 201 });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      return NextResponse.json({ error: (e as Error).message }, { status });
    }
  }

  let caseId = body.caseId ?? null;
  const narrative = buildIntakeNarrativeForModel(form);

  try {
    assertDeepSeekConfigured();
    if (!caseId) {
      const structured = await runDeepseekFundamentalStructure(narrative);
      const { id } = await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId: null,
        form,
      });
      caseId = id;
      await applyFundamentalStructure({
        workspaceId,
        userId: user.id,
        caseId,
        form,
        structured,
      });
    } else {
      await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId,
        form,
      });

      const row = await prisma.case.findFirst({
        where: { id: caseId, workspaceId, deletedAt: null },
        select: { metadataJson: true },
      });
      const meta = (row?.metadataJson ?? {}) as Record<string, unknown>;
      if (meta["intakeStructuredAt"]) {
        return NextResponse.json(
          { error: "Este caso já foi estruturado a partir da entrevista fundamental." },
          { status: 409 },
        );
      }

      const structured = await runDeepseekFundamentalStructure(narrative);
      await applyFundamentalStructure({
        workspaceId,
        userId: user.id,
        caseId,
        form,
        structured,
      });
    }

    const c = await getCaseById(workspaceId, caseId);
    if (!c) {
      return NextResponse.json({ error: "Caso não encontrado após estruturar." }, { status: 500 });
    }
    revalidateCaseSurface(caseId);
    return NextResponse.json({ case: c, mode: "fundamental_structured" }, { status: 200 });
  } catch (e) {
    const normalized = normalizeAiProviderError(e);
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
