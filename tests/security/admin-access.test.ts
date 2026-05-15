import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getCorpusStats } from "@/app/api/admin/corpus-stats/route";
import { requirePermission } from "@/lib/auth/session";
import { MembershipRole } from "@prisma/client";

vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    legalNorm: {
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    legalNormVersion: { count: vi.fn().mockResolvedValue(0) },
    legalChunk: { count: vi.fn().mockResolvedValue(0) },
    legalCitation: { count: vi.fn().mockResolvedValue(0) },
    ingestionWatermark: { findMany: vi.fn().mockResolvedValue([]) },
    ingestionJob: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/corpus/providers/registry", () => ({
  snapshotProviderStatuses: vi.fn().mockReturnValue([]),
}));

describe("Admin Access", () => {
  beforeEach(() => {
    vi.stubEnv("QDRANT_URL", "");
  });

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

    const res = await getCorpusStats();
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toHaveProperty("totals");
    expect(json).toHaveProperty("providers");
  });
});
