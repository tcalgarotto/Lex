/**
 * POST /api/lawyer-brain/ingest — upload texto de peça vencedora (markdown/plain).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { ingestWinningPiece } from "@/lib/lawyer-brain/ingest";

export const dynamic = "force-dynamic";

const Body = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(80).max(800_000),
});

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const result = await ingestWinningPiece({
    workspaceId,
    userId: user.id,
    title: parsed.title,
    bodyMarkdown: parsed.body,
  });

  return NextResponse.json(result, { status: 201 });
}
