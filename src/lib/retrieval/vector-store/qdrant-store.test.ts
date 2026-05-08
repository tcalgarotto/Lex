import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock do client Qdrant antes do import do store
vi.mock("@qdrant/js-client-rest", () => {
  const deleteFn = vi.fn(async () => undefined);
  const upsertFn = vi.fn(async () => undefined);
  const searchFn = vi.fn(async () => []);
  return {
    QdrantClient: class {
      delete = deleteFn;
      upsert = upsertFn;
      search = searchFn;
      static __delete = deleteFn;
      static __upsert = upsertFn;
      static __search = searchFn;
    },
  };
});

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    QDRANT_URL: "http://qdrant.test",
    QDRANT_API_KEY: "",
    QDRANT_COLLECTION: "lex_main",
  }),
}));

import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "./qdrant-store";

describe("QdrantVectorStore.deleteByDocumentId tenant safety", () => {
  beforeEach(() => {
    (QdrantClient as unknown as { __delete: { mockClear: () => void } }).__delete.mockClear();
  });

  it("rejeita chamada sem workspaceId (segurança multi-tenant)", async () => {
    const store = new QdrantVectorStore();
    await expect(
      // @ts-expect-error — checagem em runtime; chamada sem workspaceId
      store.deleteByDocumentId("doc-1"),
    ).rejects.toThrow(/workspaceId/i);
  });

  it("rejeita workspaceId vazio", async () => {
    const store = new QdrantVectorStore();
    await expect(store.deleteByDocumentId("doc-1", "")).rejects.toThrow(/workspaceId/i);
  });

  it("rejeita documentId vazio", async () => {
    const store = new QdrantVectorStore();
    await expect(store.deleteByDocumentId("", "ws-1")).rejects.toThrow(/documentId/i);
  });

  it("envia must filter com documentId E workspaceId quando ambos válidos", async () => {
    const store = new QdrantVectorStore();
    await store.deleteByDocumentId("doc-1", "ws-1");
    const deleteFn = (QdrantClient as unknown as {
      __delete: { mock: { calls: unknown[][] } };
    }).__delete;
    expect(deleteFn.mock.calls.length).toBe(1);
    const args = deleteFn.mock.calls[0]!;
    expect(args[0]).toBe("lex_main");
    const payload = args[1] as { filter: { must: Array<{ key: string; match: { value: string } }> } };
    const keys = payload.filter.must.map((c) => c.key);
    expect(keys).toContain("documentId");
    expect(keys).toContain("workspaceId");
    const wsClause = payload.filter.must.find((c) => c.key === "workspaceId")!;
    expect(wsClause.match.value).toBe("ws-1");
    const docClause = payload.filter.must.find((c) => c.key === "documentId")!;
    expect(docClause.match.value).toBe("doc-1");
  });
});
