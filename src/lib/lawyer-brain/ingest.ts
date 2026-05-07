/**
 * Ingestão de peça vencedora — persiste LegalPiece + MemoryEntry + merge em StyleProfile.
 */

import type { Prisma } from "@prisma/client";
import { MemoryKind } from "@prisma/client";
import { extractCitations } from "@/lib/corpus/citations";
import { prisma } from "@/lib/prisma";
import { computeStructureFingerprint, computeWritingFingerprint } from "./fingerprint";

export const WINNING_SAMPLE_KIND = "WINNING_SAMPLE";

export type IngestWinningPieceArgs = {
  workspaceId: string;
  userId: string;
  title: string;
  bodyMarkdown: string;
};

export type IngestWinningPieceResult = {
  pieceId: string;
  preferredUrns: string[];
  writingFingerprint: ReturnType<typeof computeWritingFingerprint>;
  structureFingerprint: ReturnType<typeof computeStructureFingerprint>;
};

type LawyerBrainJson = {
  preferredCitations?: string[];
  samplesCount?: number;
  lastIngestAt?: string;
};

async function mergeLawyerBrainProfile(params: {
  workspaceId: string;
  userId: string;
  wf: ReturnType<typeof computeWritingFingerprint>;
  sf: ReturnType<typeof computeStructureFingerprint>;
  preferredUrns: string[];
}): Promise<void> {
  const existing = await prisma.styleProfile.findFirst({
    where: { workspaceId: params.workspaceId, userId: params.userId },
  });

  const prevBrain =
    existing?.profileJson &&
    typeof existing.profileJson === "object" &&
    existing.profileJson !== null &&
    "lawyerBrain" in existing.profileJson
      ? ((existing.profileJson as { lawyerBrain?: LawyerBrainJson }).lawyerBrain ?? {})
      : {};

  const mergedUrns = Array.from(
    new Set([...(prevBrain.preferredCitations ?? []), ...params.preferredUrns]),
  ).slice(0, 80);

  const lawyerBrain = {
    writingFingerprint: params.wf,
    structureFingerprint: params.sf,
    preferredCitations: mergedUrns,
    samplesCount: (prevBrain.samplesCount ?? 0) + 1,
    lastIngestAt: new Date().toISOString(),
  };

  const baseProfile =
    existing?.profileJson && typeof existing.profileJson === "object" && existing.profileJson !== null
      ? (existing.profileJson as Record<string, unknown>)
      : {};

  const profileJson = { ...baseProfile, lawyerBrain } as Prisma.InputJsonValue;

  if (existing) {
    await prisma.styleProfile.update({
      where: { id: existing.id },
      data: {
        profileJson,
        metricsJson: {
          ...(existing.metricsJson && typeof existing.metricsJson === "object"
            ? (existing.metricsJson as object)
            : {}),
          lawyerBrainSamples: lawyerBrain.samplesCount,
        } as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.styleProfile.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        profileJson,
        recurringPhrases: [],
        metricsJson: { lawyerBrainSamples: 1 } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function ingestWinningPiece(args: IngestWinningPieceArgs): Promise<IngestWinningPieceResult> {
  const citations = extractCitations(args.bodyMarkdown);
  const preferredUrns = Array.from(new Set(citations.map((c) => c.targetUrn))).slice(0, 40);

  const wf = computeWritingFingerprint(args.bodyMarkdown);
  const sf = computeStructureFingerprint(args.bodyMarkdown);

  const piece = await prisma.legalPiece.create({
    data: {
      workspaceId: args.workspaceId,
      kind: WINNING_SAMPLE_KIND,
      title: args.title,
      contentJson: {
        type: "markdown",
        markdown: args.bodyMarkdown,
        fingerprints: { writing: wf, structure: sf },
        preferredUrns,
      } as unknown as Prisma.InputJsonValue,
      aiMetaJson: {
        source: "lawyer_brain_ingest",
        citationCount: citations.length,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.memoryEntry.create({
    data: {
      workspaceId: args.workspaceId,
      kind: MemoryKind.STYLE_NOTE,
      title: `Peça vencedora: ${args.title}`,
      content:
        `Fingerprint escrita: tom ${wf.estimatedTone}. Seções: ${sf.detectedSections.length}. URNs: ${preferredUrns.slice(0, 5).join(", ")}.`,
    },
  });

  await mergeLawyerBrainProfile({
    workspaceId: args.workspaceId,
    userId: args.userId,
    wf,
    sf,
    preferredUrns,
  });

  return {
    pieceId: piece.id,
    preferredUrns,
    writingFingerprint: wf,
    structureFingerprint: sf,
  };
}
