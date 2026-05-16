import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicAppUrl, isProductionAppUrlMisconfigured } from "@/lib/marketing/app-url";

describe("getPublicAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa NEXT_PUBLIC_APP_URL quando definida", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.lex.example");
    expect(getPublicAppUrl()).toBe("https://app.lex.example");
  });

  it("usa VERCEL_URL como fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "lex-navy.vercel.app");
    expect(getPublicAppUrl()).toBe("https://lex-navy.vercel.app");
  });

  it("fallback localhost em dev", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(getPublicAppUrl()).toBe("http://localhost:3000");
  });
});

describe("isProductionAppUrlMisconfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("alerta localhost em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(isProductionAppUrlMisconfigured()).toBe(true);
  });
});
