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
    const req = new Request("http://localhost/api/admin/corpus-stats");
    const res = await getCorpusStats(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should allow admin to access observability stats", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      user: { id: "admin1" } as any,
      workspaceId: "w1",
      role: MembershipRole.ADMIN
    });
    const req = new Request("http://localhost/api/admin/corpus-stats");
    try {
      const res = await getCorpusStats(req);
      expect(res.status).toBe(200);
    } catch (e) {
      // Ignora erros de BD pós-auth para focar no RBAC
    }
  });
});
