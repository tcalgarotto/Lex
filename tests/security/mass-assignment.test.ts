import { describe, it, expect, vi } from "vitest";
import { POST as createCase } from "@/app/api/cases/route";
import { getWorkspaceContext } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn(),
}));

const mockCaseCreate = vi.fn().mockResolvedValue({ id: "case_1" });

type TxClient = {
  case: { create: typeof mockCaseCreate };
  caseTimelineEvent: { create: ReturnType<typeof vi.fn> };
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: TxClient) => Promise<unknown>) =>
      cb({
        case: { create: mockCaseCreate },
        caseTimelineEvent: { create: vi.fn() },
      }),
    ),
  },
}));

type CaseCreatePayload = {
  data?: {
    workspaceId?: string;
    isAdmin?: boolean;
    role?: string;
  };
};

describe("Mass Assignment Security", () => {
  it("should ignore injected fields like workspaceId and role in POST payload", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      user: { id: "user1", email: "user1@test.local" },
      workspaceId: "legit_workspace",
    } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>);

    const maliciousPayload: Record<string, unknown> = {
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
    const firstArg = mockCaseCreate.mock.calls[0]?.[0];
    expect(firstArg).toBeDefined();
    const callArgs = firstArg as CaseCreatePayload;
    expect(callArgs.data?.workspaceId).toBe("legit_workspace");
    expect(callArgs.data?.workspaceId).not.toBe("attacker_workspace");
    expect(callArgs.data?.isAdmin).toBeUndefined();
    expect(callArgs.data?.role).toBeUndefined();
  });
});
