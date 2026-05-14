import { describe, it, expect, vi } from "vitest";
import { POST as createCase } from "@/app/api/cases/fundamental-intake/route";
import { getWorkspaceContext } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContext: vi.fn(),
}));

describe("Auth Required", () => {
  it("should block unauthenticated requests to API", async () => {
    vi.mocked(getWorkspaceContext).mockRejectedValue(new Error("Sessão não encontrada"));
    const req = new Request("http://localhost/api/cases/fundamental-intake", {
      method: "POST",
      body: JSON.stringify({}),
    });
    try {
      await createCase(req);
      throw new Error("Expected to throw");
    } catch (e: any) {
      expect(e.message).toMatch(/Sessão não encontrada/);
    }
  });
});
