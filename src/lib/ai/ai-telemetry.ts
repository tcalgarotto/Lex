/**
 * Telemetria Vercel AI SDK → Langfuse (OpenTelemetry).
 * @see https://langfuse.com/docs/integrations/vercel-ai-sdk
 */

import { isLangfuseOtelEnabled } from "@/lib/observability/langfuse-otel";

export type AiTelemetryOptions = {
  /** Identificador estável da operação (ex.: chat-stream, draft-generation). */
  functionId?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
};

/** Opções para `experimental_telemetry` em generateText/streamText. */
export function aiTelemetry(opts?: AiTelemetryOptions) {
  const enabled = isLangfuseOtelEnabled();
  const metadata: Record<string, string | number | boolean> = {
    environment: process.env["VERCEL_ENV"] ?? process.env["NODE_ENV"] ?? "development",
  };
  if (opts?.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) {
      if (v !== undefined) metadata[k] = v;
    }
  }
  return {
    isEnabled: enabled,
    functionId: opts?.functionId,
    metadata: enabled ? metadata : undefined,
  };
}
