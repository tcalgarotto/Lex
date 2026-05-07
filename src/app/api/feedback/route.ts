import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const body = (await req.json()) as {
    rating: number;
    comment?: string;
    difficulty?: string;
    highlight?: string;
    processId?: string | null;
  };

  const rating = Math.max(1, Math.min(5, Number(body.rating ?? 0)));
  if (!rating) return NextResponse.json({ error: "rating inválido" }, { status: 400 });

  const feedback = await prisma.feedbackEntry.create({
    data: {
      workspaceId,
      userId: user.id,
      processId: body.processId || null,
      rating,
      comment: body.comment?.trim() || null,
      difficulty: body.difficulty?.trim() || null,
      highlight: body.highlight?.trim() || null,
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "feedback.submitted",
      title: "Feedback enviado",
      metaJson: { rating, processId: body.processId ?? null, feedbackId: feedback.id },
    },
  });

  return NextResponse.json({ ok: true });
}

