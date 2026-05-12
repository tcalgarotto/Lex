/**
 * GET /api/lawyer-brain — snapshot da memória de estilo / brain do advogado no workspace.
 */

import { MemoryKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { WINNING_SAMPLE_KIND } from "@/lib/lawyer-brain/ingest";


export async function GET() {
  const { workspaceId, user } = await getWorkspaceContext();

  const profile = await prisma.styleProfile.findFirst({
    where: { workspaceId, userId: user.id },
  });

  const lawyerBrain =
    profile?.profileJson &&
    typeof profile.profileJson === "object" &&
    profile.profileJson !== null &&
    "lawyerBrain" in profile.profileJson
      ? (profile.profileJson as { lawyerBrain?: unknown }).lawyerBrain
      : null;

  const samples = await prisma.legalPiece.findMany({
    where: { workspaceId, kind: WINNING_SAMPLE_KIND },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: { id: true, title: true, updatedAt: true },
  });

  const styleNotes = await prisma.memoryEntry.findMany({
    where: { workspaceId, kind: MemoryKind.STYLE_NOTE },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, title: true, content: true, updatedAt: true },
  });

  return NextResponse.json({
    lawyerBrain,
    recurringPhrases: profile?.recurringPhrases ?? [],
    metricsJson: profile?.metricsJson ?? null,
    winningSamples: samples,
    styleMemory: styleNotes,
  });
}
