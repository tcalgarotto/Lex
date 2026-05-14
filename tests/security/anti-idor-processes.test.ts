import { describe, it, expect, vi } from "vitest";
import { GET as getProcessDocs } from "@/app/api/processes/[processId]/documents/route";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth/session", () => ({ getWorkspaceContext: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { process: { findFirst: vi.fn() } },
}));

describe("Anti-IDOR: Processes", () => {
  it("should prevent access to cross-workspace processes", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      user: { id: "u1", email: "u1@test.local" },
      workspaceId: "w1",
    } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>);
    vi.mocked(prisma.process.findFirst).mockResolvedValue(null);
    const req = new Request("http://localhost/api/processes/proc_2/documents");
    const res = await getProcessDocs(req, { params: Promise.resolve({ processId: "proc_2" }) });
    expect(res.status).toBe(404);
  });
});
