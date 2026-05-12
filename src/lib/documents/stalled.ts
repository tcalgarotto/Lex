import { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STALLED_THRESHOLDS_MS } from "./status-display";

export type StalledDocumentBrief = {
  id: string;
  originalName: string;
  status: DocumentStatus;
  updatedAt: Date;
};

/**
 * Lista documentos travados em um workspace. "Travado" = ficou em um
 * estágio intermediário (`PARSING`/`CHUNKING`/`EMBEDDING`) sem update por
 * mais tempo que o threshold do estágio. O cálculo é feito em SQL
 * (`updatedAt < now - threshold`) usando o maior dos thresholds como
 * filtro grosso, e refinado in-memory por estágio.
 */
export async function findStalledDocuments(
  workspaceId: string,
  options: { take?: number; now?: Date } = {},
): Promise<StalledDocumentBrief[]> {
  const now = options.now ?? new Date();
  const take = options.take ?? 50;

  // Maior threshold ativo. Como hoje é 20min (EMBEDDING), começamos com ele
  // como teto e refinamos por estágio.
  const minThreshold = Math.min(
    ...Object.values(STALLED_THRESHOLDS_MS).filter(
      (v): v is number => typeof v === "number",
    ),
  );

  const cutoff = new Date(now.getTime() - minThreshold);

  const candidates = await prisma.document.findMany({
    where: {
      workspaceId,
      status: {
        in: [DocumentStatus.PARSING, DocumentStatus.CHUNKING, DocumentStatus.EMBEDDING],
      },
      updatedAt: { lt: cutoff },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(take * 2, take),
    select: {
      id: true,
      originalName: true,
      status: true,
      updatedAt: true,
    },
  });

  return candidates
    .filter((doc) => {
      const threshold = STALLED_THRESHOLDS_MS[doc.status];
      if (threshold === null) return false;
      return now.getTime() - doc.updatedAt.getTime() > threshold;
    })
    .slice(0, take);
}
