import { describe, it, expect, vi } from "vitest";
import { GET as getDocument } from "@/app/api/documents/[documentId]/route";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findFirst: vi.fn().mockResolvedValue(null) },
    document: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
  },
}));

describe("Anti-IDOR: Documents", () => {
  it("should prevent GET document from another workspace", async () => {
    const mockUser: Pick<User, "id" | "email" | "createdAt" | "updatedAt"> = {
      id: "u1",
      email: "u1@test.local",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getWorkspaceContext).mockResolvedValue({ user: mockUser as User, workspaceId: "w1" });
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);
    const req = new Request("http://localhost/api/documents/doc_2");
    const res = await getDocument(req, { params: Promise.resolve({ documentId: "doc_2" }) });
    expect(res.status).toBe(404);
  });
});
