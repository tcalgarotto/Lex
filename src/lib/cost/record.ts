import type { CostCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimateLlmCostUsd } from "@/lib/cost/estimate";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.cost");

export function recordCostEntry(data: {
  workspaceId: string;
  userId?: string | null;
  category: CostCategory;
  provider: string;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  unitQuantity?: number | null;
  metaJson?: Prisma.InputJsonValue;
}): void {
  void prisma.costLedgerEntry
    .create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId ?? undefined,
        category: data.category,
        provider: data.provider,
        model: data.model ?? undefined,
        promptTokens: data.promptTokens ?? undefined,
        completionTokens: data.completionTokens ?? undefined,
        totalTokens: data.totalTokens ?? undefined,
        unitQuantity: data.unitQuantity ?? undefined,
        costUsd:
          data.model && (data.promptTokens || data.completionTokens)
            ? estimateLlmCostUsd({
                modelId: data.model,
                promptTokens: data.promptTokens ?? undefined,
                completionTokens: data.completionTokens ?? undefined,
              })
            : undefined,
        metaJson: data.metaJson ?? undefined,
      },
    })
    .catch((e) => {
      log.warn("cost record failed (non-fatal)", {
        err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
      });
    });
}
