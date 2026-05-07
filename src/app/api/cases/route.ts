/**
 * GET  /api/cases       — lista os casos do workspace ativo (paginado básico).
 * POST /api/cases       — cria caso a partir de texto livre (intake).
 *
 * Auth: requer sessão + workspace ativo.
 * Multi-tenant: tudo escopado por workspaceId.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { listCases } from "@/lib/cases/repository";
import { intakeWorkflow } from "@/lib/cases/orchestrator";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  rawInput: z.string().min(20, "Descreva o caso com pelo menos 20 caracteres.").max(50_000),
});

export async function GET(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && Object.values(CaseStatus).includes(statusParam as CaseStatus)
    ? (statusParam as CaseStatus)
    : null;
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") ?? "20")));
  const cases = await listCases(workspaceId, { take, status });
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
  const { case: c, intake } = await intakeWorkflow({
    workspaceId,
    userId: user.id,
    rawInput: body.rawInput,
  });
  return NextResponse.json({ case: c, intake }, { status: 201 });
}
