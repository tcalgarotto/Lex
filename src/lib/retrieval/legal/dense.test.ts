/**
 * Testes do dense retriever: foco em `buildQdrantFilter` (multi-tenant +
 * compatibilidade legado `__global__`).
 */
import { describe, expect, it } from "vitest";
import { buildQdrantFilter } from "./dense";
import { CORPUS_WORKSPACE_IDS } from "./qdrant-corpus-filter";
import { GLOBAL_WORKSPACE_ID, LEGAL_CORPUS_TENANT_ID } from "@/lib/constants";

describe("buildQdrantFilter (dense.ts) — multi-tenant + legado", () => {
  it("aceita workspaceId novo ou legado via match.any", () => {
    const f = buildQdrantFilter(undefined) as {
      must: Array<Record<string, unknown>>;
    };
    const ws = f.must.find((m) => (m as { key?: string }).key === "workspaceId") as {
      match?: { any?: string[] };
    };
    expect(ws?.match?.any?.sort()).toEqual([...CORPUS_WORKSPACE_IDS].sort());
    expect(ws?.match?.any).toContain(LEGAL_CORPUS_TENANT_ID);
    expect(ws?.match?.any).toContain(GLOBAL_WORKSPACE_ID);
  });

  it("append user filters em must", () => {
    const f = buildQdrantFilter({
      kinds: ["CONSTITUTION"],
      articleRefs: ["Art. 5º"],
    }) as { must: Array<Record<string, unknown>> };
    const json = JSON.stringify(f.must);
    expect(json).toContain("CONSTITUTION");
    expect(json).toContain("Art. 5º");
    expect(json).toContain("ACTIVE");
  });
});
