import { cacheGet, cacheSet } from "@/lib/redis";
import type { RetrievedChunk } from "@/lib/retrieval/types";

const TTL_SECONDS = 3600;

type HotState = {
  lastQueries: string[];
  lastSummary?: string;
};

function key(workspaceId: string, processId?: string) {
  return `lex:hot:ctx:${workspaceId}:${processId ?? "_"}`;
}

export async function getHotContextChunks(
  workspaceId: string,
  processId?: string,
): Promise<RetrievedChunk[]> {
  const raw = await cacheGet(key(workspaceId, processId));
  if (!raw) return [];
  try {
    const s = JSON.parse(raw) as HotState;
    const out: RetrievedChunk[] = [];
    if (s.lastSummary?.trim()) {
      out.push({
        id: "hot:summary",
        text: s.lastSummary.trim(),
        layer: "process_memory",
        sourceType: "process_memory",
        sourceLabel: "Contexto recente (memória quente)",
        score: null,
        meta: { hot: "summary" },
      });
    }
    const q = s.lastQueries?.filter(Boolean) ?? [];
    if (q.length) {
      out.push({
        id: "hot:queries",
        text: `Perguntas recentes neste processo:\n${q.map((x, i) => `${i + 1}. ${x}`).join("\n")}`,
        layer: "process_memory",
        sourceType: "process_memory",
        sourceLabel: "Interações recentes",
        score: null,
        meta: { hot: "queries" },
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function pushHotInteraction(params: {
  workspaceId: string;
  processId?: string;
  userMessage: string;
  assistantText: string;
}): Promise<void> {
  const k = key(params.workspaceId, params.processId);
  const raw = await cacheGet(k);
  let state: HotState = { lastQueries: [] };
  if (raw) {
    try {
      state = { lastQueries: [], ...JSON.parse(raw) };
    } catch {
      state = { lastQueries: [] };
    }
  }
  if (params.userMessage.trim()) {
    state.lastQueries = [...state.lastQueries, params.userMessage.trim()].slice(-8);
  }
  state.lastSummary = params.assistantText.trim().slice(0, 4000);
  await cacheSet(k, JSON.stringify(state), TTL_SECONDS);
}
