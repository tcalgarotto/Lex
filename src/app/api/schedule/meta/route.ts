import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/schedule/meta — dados para filtros e criação rápida na agenda LEX.
 */
export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const [cases, memberships, legalProcesses, internalProcesses] = await Promise.all([
    prisma.case.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, title: true },
    }),
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.legalProcess.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        cnjFormatted: true,
        caseId: true,
        case: { select: { title: true } },
      },
    }),
    prisma.process.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, number: true, title: true },
    }),
  ]);

  const users = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  return NextResponse.json({
    cases,
    users,
    legal_processes: legalProcesses.map((lp) => ({
      id: lp.id,
      label: lp.cnjFormatted,
      caso_id: lp.caseId,
      caso_title: lp.case?.title ?? null,
    })),
    internal_processes: internalProcesses.map((p) => ({
      id: p.id,
      label: (p.title && p.title.trim()) || p.number,
      number: p.number,
    })),
  });
}
