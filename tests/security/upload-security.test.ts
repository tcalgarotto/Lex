import { describe, it, expect, vi } from "vitest";
import { POST as uploadDoc } from "@/app/api/documents/upload/route";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/auth/session", () => ({
  getWorkspaceContextWithRole: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitHeaders: vi.fn().mockReturnValue(new Headers()),
}));

describe("Upload Security", () => {
  it("should block malicious upload extensions (unsupported MIME)", async () => {
    vi.mocked(getWorkspaceContextWithRole).mockResolvedValue({
      user: { id: "u1" } as any,
      workspaceId: "w1",
      role: "ADMIN"
    } as any);

    const fd = new FormData();
    const file = new File(["hack"], "evil.exe", { type: "application/x-msdownload" });
    fd.append("file", file);

    const req = new Request("http://localhost/api/documents/upload", {
      method: "POST",
      body: fd,
    });
    
    const res = await uploadDoc(req);
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error).toMatch(/Tipo não suportado/);
  });
});
