import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { requireCaseApiAccess } from "@/lib/cases/case-api-access";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn().mockResolvedValue({
    workspaceId: "ws_test",
    user: { id: "user_test", email: "t@example.com" },
  }),
}));

describe("requireCaseApiAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 404 when case is not in workspace", async () => {
    vi.spyOn(prisma.case, "findFirst").mockResolvedValueOnce(null);
    await expect(requireCaseApiAccess("case_missing")).rejects.toMatchObject({ status: 404 });
  });

  it("returns workspace user and case id when case exists", async () => {
    vi.spyOn(prisma.case, "findFirst").mockResolvedValueOnce({ id: "case_ok" } as never);
    const r = await requireCaseApiAccess("case_ok");
    expect(r).toEqual({
      workspaceId: "ws_test",
      user: { id: "user_test", email: "t@example.com" },
      caseId: "case_ok",
    });
  });
});
