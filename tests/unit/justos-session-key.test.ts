import { describe, expect, it } from "vitest";
import { buildSessionKey } from "@/lib/justos/whatsapp/session-service";

describe("buildSessionKey", () => {
  it("é determinístico por workspace", () => {
    const a = buildSessionKey("workspace_abc");
    const b = buildSessionKey("workspace_abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^ws_[a-f0-9]{12}$/);
  });

  it("diferencia workspaces", () => {
    expect(buildSessionKey("ws_a")).not.toBe(buildSessionKey("ws_b"));
  });
});
