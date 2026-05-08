/**
 * Testes do hybrid-qdrant: filtro tenant compartilhado com dense.ts.
 */
import { describe, expect, it } from "vitest";
import { buildHybridFilter } from "./hybrid-qdrant";
import { CORPUS_WORKSPACE_IDS } from "./qdrant-corpus-filter";

describe("buildHybridFilter", () => {
  it("usa mesmo workspaceId any que dense", () => {
    const f = buildHybridFilter(undefined) as {
      must: Array<Record<string, unknown>>;
    };
    const ws = f.must.find((m) => (m as { key?: string }).key === "workspaceId") as {
      match?: { any?: string[] };
    };
    expect(ws?.match?.any?.sort()).toEqual([...CORPUS_WORKSPACE_IDS].sort());
  });

  it("propaga asOf para validFromTs", () => {
    const asOf = new Date("2024-01-15T00:00:00Z");
    const f = buildHybridFilter({ asOf }) as { must: Array<Record<string, unknown>> };
    const ts = Math.floor(asOf.getTime() / 1000);
    expect(JSON.stringify(f.must)).toContain(String(ts));
  });
});
