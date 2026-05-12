import { NextResponse } from "next/server";
import { gatherCaseBootstrap } from "@/lib/cases/case-bootstrap";
import { requireCaseApiAccess } from "@/lib/cases/case-api-access";

/**
 * GET /api/cases/[id]/bootstrap
 *
 * Consolida dados iniciais do caso (colaboração, checklist, templates,
 * estratégia/minutas/fundamentos) numa única request após auth/workspace.
 */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const access = await requireCaseApiAccess(id);
    const payload = await gatherCaseBootstrap(access.workspaceId, access.caseId, access.user.id);
    if (!payload) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
    throw e;
  }
}
