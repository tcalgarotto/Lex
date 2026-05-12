/**
 * PATCH /api/cases/[id]/approvals/[approvalId] — decide aprovação.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { decideApproval } from "@/lib/cases/collaboration";


const PatchBody = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  rationale: z.string().max(4_000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id, approvalId } = await params;
  let parsed: z.infer<typeof PatchBody>;
  try {
    parsed = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  try {
    const args: Parameters<typeof decideApproval>[0] = {
      workspaceId,
      caseId: id,
      approvalId,
      reviewerId: user.id,
      decision: parsed.decision,
    };
    if (parsed.rationale) args.rationale = parsed.rationale;
    const updated = await decideApproval(args);
    return NextResponse.json({ approval: updated });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
