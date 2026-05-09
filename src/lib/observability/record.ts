import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.observability");

export function recordObservabilityLog(data: {
  workspaceId: string;
  userId?: string | null;
  traceId?: string | null;
  kind: string;
  name?: string | null;
  payloadJson?: Prisma.InputJsonValue;
  retrievalChunkIds?: string[] | null;
  latencyMs: number;
  errorMessage?: string | null;
}): void {
  void prisma.observabilityLog
    .create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId ?? undefined,
        traceId: data.traceId ?? undefined,
        kind: data.kind,
        name: data.name ?? undefined,
        payloadJson: data.payloadJson ?? undefined,
        retrievalChunkIds: data.retrievalChunkIds ?? undefined,
        latencyMs: data.latencyMs,
        errorMessage: data.errorMessage ?? undefined,
      },
    })
    .catch((e) => {
      log.warn("observability record failed (non-fatal)", {
        err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
      });
    });
}
