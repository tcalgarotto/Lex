import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isAllowedBrowserMutationOrigin } from "@/lib/security/browser-mutation-origin";

function req(url: string, host?: string) {
  return new NextRequest(url, {
    headers: host ? { host } : {},
  });
}

describe("isAllowedBrowserMutationOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita origin igual ao host da request", () => {
    const r = req("http://localhost:3000/api/settings/justos/subscribe", "localhost:3000");
    expect(isAllowedBrowserMutationOrigin(r, "http://localhost:3000")).toBe(true);
  });

  it("aceita IP LAN em dev com ALLOWED_DEV_ORIGINS", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOWED_DEV_ORIGINS", "192.168.0.27");
    const r = req("http://localhost:3000/api/settings/justos/subscribe", "localhost:3000");
    expect(isAllowedBrowserMutationOrigin(r, "http://192.168.0.27:3000")).toBe(true);
  });

  it("rejeita origem externa em dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOWED_DEV_ORIGINS", "192.168.0.27");
    const r = req("http://localhost:3000/api/x", "localhost:3000");
    expect(isAllowedBrowserMutationOrigin(r, "http://evil.example:3000")).toBe(false);
  });
});
