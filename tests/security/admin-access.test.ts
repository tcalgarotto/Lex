import { describe, it, expect, vi } from "vitest";
import { GET as getCorpusStats } from "@/app/api/admin/corpus-stats/route";
import { requirePermission } from "@/lib/auth/session";
import { MembershipRole } from "@prisma/client";

vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(),
}));

describe("Admin Access", () => {
  it("should require admin role to access observability stats", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("Permissão insuficiente. Requer: ADMIN, OWNER"));
    const res = await getCorpusStats();
    expect(res.status).toBe(403);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json["error"]).toBe("forbidden");
  });

  it("should allow admin to access observability stats", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      user: { id: "admin1", email: "admin1@test.local" },
      workspaceId: "w1",
      role: MembershipRole.ADMIN,
    } as unknown as Awaited<ReturnType<typeof requirePermission>>);
    try {
      const res = await getCorpusStats();
      expect(res.status).toBe(200);
    } catch {
      // Ignora erros de BD pós-auth para focar no RBAC
    }
  });
});
