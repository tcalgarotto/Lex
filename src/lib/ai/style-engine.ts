import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
}

function topPhrases(texts: string[], k: number): string[] {
  const freq = new Map<string, number>();
  for (const t of texts) {
    const toks = tokenize(t);
    const seen = new Set<string>();
    for (const w of toks) {
      if (seen.has(w)) continue;
      seen.add(w);
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w);
}

export async function analyzePiecesAndUpdateStyle(params: {
  workspaceId: string;
  userId: string | null;
}): Promise<void> {
  const pieces = await prisma.legalPiece.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  const texts = pieces.map((p) => JSON.stringify(p.contentJson));
  const phrases = topPhrases(texts, 12);
  const avgLen =
    texts.length === 0
      ? 0
      : Math.round(texts.reduce((a, t) => a + t.length, 0) / texts.length);

  const profileJson: Prisma.InputJsonValue = {
    formalidade: "alta",
    doutrina: pieces.length > 5 ? "moderada" : "baixa",
    jurisprudencia: pieces.length > 8 ? "frequente" : "moderada",
    tom: "tecnico",
    frases_recorrentes: phrases,
    avgPieceJsonLength: avgLen,
  };

  const existing = await prisma.styleProfile.findFirst({
    where: { workspaceId: params.workspaceId },
  });
  if (existing) {
    await prisma.styleProfile.update({
      where: { id: existing.id },
      data: {
        profileJson,
        recurringPhrases: phrases,
        metricsJson: { sampleSize: pieces.length },
      },
    });
  } else {
    await prisma.styleProfile.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        profileJson,
        recurringPhrases: phrases,
        metricsJson: { sampleSize: pieces.length },
      },
    });
  }
}
