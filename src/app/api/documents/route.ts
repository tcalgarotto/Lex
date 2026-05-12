/**
 * GET /api/documents — lista documentos do workspace.
 *
 * Query params:
 *   - `unlinked=1` — apenas documentos sem `caseId`.
 *   - `take` — máximo 100 (default 50).
 *
 * Auth: requer sessão + workspace ativo.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { officePrivateDocumentsAndParts } from "@/lib/documents/office-list-filter";


export async function GET(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const url = new URL(req.url);
  const unlinked = url.searchParams.get("unlinked") === "1";
  const takeRaw = Number(url.searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeRaw) ? Math.min(100, Math.max(1, takeRaw)) : 50;

  const andParts = [...officePrivateDocumentsAndParts(user.id)];
  if (unlinked) andParts.push({ caseId: null });

  const documents = await prisma.document.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      archivedAt: null,
      AND: andParts,
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      originalName: true,
      status: true,
      updatedAt: true,
      caseId: true,
      processId: true,
    },
  });

  return NextResponse.json({ documents });
}
