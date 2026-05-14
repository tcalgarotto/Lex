import { describe, it, expect, vi } from "vitest";
import { GET as getDraft } from "@/app/api/cases/[id]/drafts/[draftId]/route";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

vi.mock("@/lib/auth/session", () => ({ getWorkspaceContext: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { 
    caseDraft: { findFirst: vi.fn() },
    case: { findFirst: vi.fn() }
  },
}));

describe("Anti-IDOR: Drafts", () => {
  it("should prevent GET draft from another workspace", async () => {
    const mockUser = { id: "u1" };
    // @ts-expect-error mock incompleto
    vi.mocked(getWorkspaceContext).mockResolvedValue({ user: mockUser as User, workspaceId: "w1" });
    vi.mocked(prisma.caseDraft.findFirst).mockResolvedValue(null);
    const req = new Request("http://localhost/api/cases/c1/drafts/d1");
    const res = await getDraft(req, { params: Promise.resolve({ id: "c1", draftId: "d1" }) });
    expect(res.status).toBe(404);
  });
});
