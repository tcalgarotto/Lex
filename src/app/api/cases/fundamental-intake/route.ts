/**
 * POST /api/cases/fundamental-intake
 *
 * - action=draft: grava rascunho (cria caso ou atualiza `caseId`).
 * - action=structure: grava formulário, chama DeepSeek, persiste partes/fatos/pedidos/riscos/brain.
 *
 * Não dispara consolidação Inngest (fluxo principal DeepSeek + Postgres).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCaseById } from "@/lib/cases/repository";
import { parseFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { runDeepseekFundamentalStructure } from "@/lib/cases/fundamental-intake/deepseek-structure";
import { buildIntakeNarrativeForModel } from "@/lib/cases/fundamental-intake/build-narrative";
import {
  applyFundamentalStructure,
  persistFundamentalDraft,
} from "@/lib/cases/fundamental-intake/fundamental-intake-service";

const PostBody = z.object({
  action: z.enum(["draft", "structure"]),
  caseId: z.string().cuid().optional(),
  form: z.unknown(),
});

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

  if (body.action === "draft") {
    try {
      const { id } = await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId: body.caseId ?? null,
        form,
      });
      const c = await getCaseById(workspaceId, id);
      return NextResponse.json({ case: c, mode: "fundamental_draft" }, { status: body.caseId ? 200 : 201 });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      return NextResponse.json({ error: (e as Error).message }, { status });
    }
  }

  let caseId = body.caseId ?? null;
  try {
    if (!caseId) {
      const created = await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId: null,
        form,
      });
      caseId = created.id;
    } else {
      await persistFundamentalDraft({
        workspaceId,
        userId: user.id,
        caseId,
        form,
      });
    }

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

    const narrative = buildIntakeNarrativeForModel(form);
    const structured = await runDeepseekFundamentalStructure(narrative);

    await applyFundamentalStructure({
      workspaceId,
      userId: user.id,
      caseId,
      form,
      structured,
    });

    const c = await getCaseById(workspaceId, caseId);
    return NextResponse.json({ case: c, mode: "fundamental_structured" }, { status: 200 });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg.includes("Modelo") || msg.includes("JSON") ? 502 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
