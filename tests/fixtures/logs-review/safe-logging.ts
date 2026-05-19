/** Fixture — padrões seguros (não deve gerar P0/P1). */
import { getLogger } from "@/lib/logger";
import { recordObservabilityLog } from "@/lib/observability/record";

const log = getLogger("fixture.safe");

export function safeLogging(workspaceId: string, query: string) {
  log.info("retrieval.ok", {
    workspaceId,
    requestId: "req_fixture",
    queryLen: query.length,
    chunkCount: 3,
    durationMs: 42,
    provider: "deepseek",
    status: "ok",
  });

  recordObservabilityLog({
    workspaceId,
    kind: "fixture.safe",
    latencyMs: 10,
    payloadJson: {
      queryLen: query.length,
      traceId: "trace_fixture",
      engine: "test",
    },
  });
}
