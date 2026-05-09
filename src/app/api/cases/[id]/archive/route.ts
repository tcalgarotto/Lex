import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { archiveCase, restoreCase } from "@/lib/cases/repository";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  try {
    await archiveCase({ workspaceId, caseId: id, userId: user.id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  try {
    await restoreCase({ workspaceId, caseId: id, userId: user.id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}

