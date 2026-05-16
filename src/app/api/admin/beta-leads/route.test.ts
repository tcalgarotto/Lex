import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/admin/beta-leads/route";

vi.mock("@/lib/auth/beta-leads-admin", () => ({
  requireBetaLeadsAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    betaLeadRequest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("GET /api/admin/beta-leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exige admin autorizado", async () => {
    const { requireBetaLeadsAdmin } = await import("@/lib/auth/beta-leads-admin");
    vi.mocked(requireBetaLeadsAdmin).mockRejectedValue(new Error("forbidden"));

    await expect(GET()).rejects.toThrow("forbidden");
  });

  it("retorna lista para admin", async () => {
    const { requireBetaLeadsAdmin } = await import("@/lib/auth/beta-leads-admin");
    vi.mocked(requireBetaLeadsAdmin).mockResolvedValue({
      id: "u1",
      email: "owner@test.local",
    } as Awaited<ReturnType<typeof requireBetaLeadsAdmin>>);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { leads: unknown[] };
    expect(Array.isArray(json.leads)).toBe(true);
  });
});
