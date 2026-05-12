/**
 * GET  /api/cases/[id]/comments — lista comentários internos do caso.
 * POST /api/cases/[id]/comments — adiciona comentário (auto-notificação).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseCommentVisibility } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addComment, listComments } from "@/lib/cases/collaboration";


const PostBody = z.object({
  body: z.string().min(1).max(8_000),
  draftId: z.string().min(1).optional(),
  visibility: z.nativeEnum(CaseCommentVisibility).optional(),
  refChunkIds: z.array(z.string()).max(20).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const comments = await listComments({ workspaceId, caseId: id });
  return NextResponse.json({ comments });
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
    const args: Parameters<typeof addComment>[0] = {
      workspaceId,
      caseId: id,
      authorId: user.id,
      body: parsed.body,
    };
    if (parsed.draftId) args.draftId = parsed.draftId;
    if (parsed.visibility) args.visibility = parsed.visibility;
    if (parsed.refChunkIds) args.refChunkIds = parsed.refChunkIds;
    const created = await addComment(args);
    return NextResponse.json({ comment: created }, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
