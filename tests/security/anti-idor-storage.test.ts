import { describe, it, expect, vi } from "vitest";
import { GET as getDocumentFile } from "@/app/api/documents/[documentId]/file/route";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth/session", () => ({ getWorkspaceContext: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/biblioteca/platform-library", () => ({
  documentReadScopeOr: vi.fn().mockReturnValue({ workspaceId: "w1" }),
}));

describe("Anti-IDOR: Storage", () => {
  it("should block cross-tenant storage access", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      user: { id: "u1", email: "u1@test.local" },
      workspaceId: "w1",
    } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);
    const req = new Request("http://localhost/api/documents/doc_2/file");
    const res = await getDocumentFile(req, { params: Promise.resolve({ documentId: "doc_2" }) });
    expect(res.status).toBe(404);
  });
});
