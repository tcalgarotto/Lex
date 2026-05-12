/**
 * GET  /api/cases/[id]/annotations — lista anotações do caso/draft.
 * POST /api/cases/[id]/annotations — cria anotação (highlight/weakness/strength).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseAnnotationKind } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addAnnotation, listAnnotations } from "@/lib/cases/collaboration";


const PostBody = z.object({
  draftId: z.string().min(1).optional(),
  kind: z.nativeEnum(CaseAnnotationKind).optional(),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(1),
  excerpt: z.string().min(1).max(4_000),
  note: z.string().max(4_000).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const url = new URL(req.url);
  const draftId = url.searchParams.get("draftId");
  const args: Parameters<typeof listAnnotations>[0] = { workspaceId, caseId: id };
  if (draftId) args.draftId = draftId;
  const items = await listAnnotations(args);
  return NextResponse.json({ annotations: items });
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
    const args: Parameters<typeof addAnnotation>[0] = {
      workspaceId,
      caseId: id,
      authorId: user.id,
      startOffset: parsed.startOffset,
      endOffset: parsed.endOffset,
      excerpt: parsed.excerpt,
    };
    if (parsed.draftId) args.draftId = parsed.draftId;
    if (parsed.kind) args.kind = parsed.kind;
    if (parsed.note) args.note = parsed.note;
    const created = await addAnnotation(args);
    return NextResponse.json({ annotation: created }, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
