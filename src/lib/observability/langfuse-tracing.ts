import { after } from "next/server";
import { propagateAttributes, setActiveTraceIO } from "@langfuse/tracing";
import { flushLangfuseOtel, isLangfuseOtelEnabled } from "@/lib/observability/langfuse-otel";

function isAfterOutsideRequestScope(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("outside a request scope") ||
      error.message.includes("next-dynamic-api-wrong-context"))
  );
}

/**
 * Agenda flush após a resposta (serverless). Fora de request scope (ex.: vitest) é noop.
 */
export function scheduleLangfuseFlush(): void {
  if (!isLangfuseOtelEnabled()) return;
  try {
    after(async () => {
      await flushLangfuseTraces();
    });
  } catch (error) {
    if (!isAfterOutsideRequestScope(error)) throw error;
  }
}

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
