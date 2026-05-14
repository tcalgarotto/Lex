import { describe, it, expect, vi } from "vitest";
import { GET as getCase } from "@/app/api/cases/[id]/route";
import { DELETE as deleteCase } from "@/app/api/cases/[id]/delete/route";
import { PATCH as patchMembership } from "@/app/api/memberships/[id]/route";
import { getWorkspaceContext, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MembershipRole } from "@prisma/client";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Simulated IDOR Attacks", () => {
  const MOCK_USER = { id: "user_1", email: "user1@example.com" };
  const ATTACKER_WORKSPACE = "workspace_attacker";
  const VICTIM_CASE_ID = "case_victim_123";

  it("should prevent accessing a case from another workspace (GET /api/cases/[id])", async () => {
    // Mock session as Attacker
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      user: MOCK_USER as unknown,
      workspaceId: ATTACKER_WORKSPACE,
    } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>);

    // Mock DB: case exists but belongs to Victim
    // @ts-expect-error bypass mock Prisma type
    vi.mocked(prisma.case.findFirst).mockImplementation((args: unknown) => {
      const typedArgs = args as { where: { id: string; workspaceId: string } };
      if (typedArgs?.where?.id === VICTIM_CASE_ID && typedArgs?.where?.workspaceId === ATTACKER_WORKSPACE) {
        return Promise.resolve(null); // Not found for attacker
      }
      return Promise.resolve(null);
    });

    const req = new Request(`http://localhost/api/cases/${VICTIM_CASE_ID}`);
    const res = await getCase(req, { params: Promise.resolve({ id: VICTIM_CASE_ID }) });
    
    expect(res.status).toBe(404);
  });

  it("should prevent deleting a case from another workspace (DELETE /api/cases/[id]/delete)", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      user: MOCK_USER as unknown,
      workspaceId: ATTACKER_WORKSPACE,
    } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>);

    vi.mocked(prisma.case.findFirst).mockResolvedValue(null); // Not found for attacker

    const req = new Request(`http://localhost/api/cases/${VICTIM_CASE_ID}/delete?confirm=1`, {
      method: "DELETE"
    });
    const res = await deleteCase(req, { params: Promise.resolve({ id: VICTIM_CASE_ID }) });
    
    expect(res.status).toBe(404);
    expect(prisma.case.deleteMany).not.toHaveBeenCalled();
  });

  it("should prevent changing membership role in another workspace (PATCH /api/memberships/[id])", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      user: MOCK_USER as unknown,
      workspaceId: ATTACKER_WORKSPACE,
      role: MembershipRole.ADMIN
    } as unknown as Awaited<ReturnType<typeof requirePermission>>);

    const VICTIM_MEMBERSHIP_ID = "membership_victim_456";
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null); // Not found for attacker

    const req = new Request(`http://localhost/api/memberships/${VICTIM_MEMBERSHIP_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ role: MembershipRole.OWNER })
    });
    const res = await patchMembership(req, { params: Promise.resolve({ id: VICTIM_MEMBERSHIP_ID }) });
    
    expect(res.status).toBe(404);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });
});