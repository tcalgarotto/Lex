import { propagateAttributes, setActiveTraceIO } from "@langfuse/tracing";
import { flushLangfuseOtel, isLangfuseOtelEnabled } from "@/lib/observability/langfuse-otel";

export type LangfuseRouteContext = {
  traceName: string;
  userId?: string;
  sessionId?: string;
  workspaceId?: string;
  caseId?: string;
  processId?: string;
  /** Input resumido para o trace (evitar prompt/documento integral). */
  inputSummary?: string;
};

export async function flushLangfuseTraces(): Promise<void> {
  await flushLangfuseOtel();
}

/**
 * Propaga user/session/tags para spans filhos (AI SDK + retrieval).
 */
export async function withLangfuseRouteContext<T>(
  ctx: LangfuseRouteContext,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isLangfuseOtelEnabled()) return fn();

  if (ctx.inputSummary) {
    setActiveTraceIO({ input: ctx.inputSummary });
  }

  const metadata: Record<string, string> = {};
  if (ctx.workspaceId) metadata["workspaceId"] = ctx.workspaceId;
  if (ctx.caseId) metadata["caseId"] = ctx.caseId;
  if (ctx.processId) metadata["processId"] = ctx.processId;

  return propagateAttributes(
    {
      traceName: ctx.traceName,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      tags: ["lex", ctx.traceName],
    },
    fn,
  );
}
