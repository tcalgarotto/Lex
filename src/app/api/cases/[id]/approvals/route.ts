/**
 * GET  /api/cases/[id]/approvals — lista pedidos/decisões de aprovação.
 * POST /api/cases/[id]/approvals — solicita aprovação de minuta (REQUESTED).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { listApprovals, requestApproval } from "@/lib/cases/collaboration";


const PostBody = z.object({
  draftId: z.string().min(1),
  reviewerId: z.string().min(1).optional(),
  rationale: z.string().max(4_000).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const approvals = await listApprovals({ workspaceId, caseId: id });
  return NextResponse.json({ approvals });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  let parsed: z.infer<typeof PostBody>;
  try {
    parsed = PostBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  try {
    const args: Parameters<typeof requestApproval>[0] = {
      workspaceId,
      caseId: id,
      draftId: parsed.draftId,
      requestedBy: user.id,
    };
    if (parsed.reviewerId) args.reviewerId = parsed.reviewerId;
    if (parsed.rationale) args.rationale = parsed.rationale;
    const created = await requestApproval(args);
    return NextResponse.json({ approval: created }, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
