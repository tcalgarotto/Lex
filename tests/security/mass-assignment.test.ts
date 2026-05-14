import { describe, it, expect, vi } from "vitest";
import { POST as createCase } from "@/app/api/cases/route";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn(),
}));

const mockCaseCreate = vi.fn().mockResolvedValue({ id: "case_1" });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn().mockImplementation(async (cb) => {
      return cb({
        case: { create: mockCaseCreate },
        caseTimelineEvent: { create: vi.fn() },
      });
    }),
  },
}));

describe("Mass Assignment Security", () => {
  it("should ignore injected fields like workspaceId and role in POST payload", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      user: { id: "user1" } as any,
      workspaceId: "legit_workspace",
    } as any);

    const maliciousPayload = {
      mode: "empty",
      title: "Normal Title",
      workspaceId: "attacker_workspace",
      userId: "other_user",
      role: "OWNER",
      isAdmin: true,
      billingPlan: "ENTERPRISE",
    };

    const req = new Request("http://localhost/api/cases", {
      method: "POST",
      body: JSON.stringify(maliciousPayload),
    });

    const res = await createCase(req);
    expect(res.status).toBe(201);

    expect(mockCaseCreate).toHaveBeenCalled();
    const callArgs = mockCaseCreate.mock.calls[0]?.[0] as any;
    expect(callArgs?.data?.workspaceId).toBe("legit_workspace");
    expect(callArgs?.data?.workspaceId).not.toBe("attacker_workspace");
    expect(callArgs?.data?.isAdmin).toBeUndefined();
    expect(callArgs?.data?.role).toBeUndefined();
  });
});
