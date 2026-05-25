import { describe, expect, it } from "vitest";
import { lanAppOriginFromEnv, parseAllowedDevOrigins } from "../../config/allowed-dev-origins";

describe("parseAllowedDevOrigins", () => {
  it("retorna undefined em produção", () => {
    expect(parseAllowedDevOrigins({ NODE_ENV: "production", ALLOWED_DEV_ORIGINS: "192.168.0.27" })).toBeUndefined();
  });

  it("aceita IP privado na LAN", () => {
    expect(parseAllowedDevOrigins({ NODE_ENV: "development", ALLOWED_DEV_ORIGINS: "192.168.0.27" })).toEqual([
      "192.168.0.27",
      "127.0.0.1",
      "localhost",
    ]);
  });

  it("rejeita IP público e asterisco global", () => {
    expect(
      parseAllowedDevOrigins({ NODE_ENV: "development", ALLOWED_DEV_ORIGINS: "8.8.8.8,*,192.168.1.1" }),
    ).toEqual(["192.168.1.1", "127.0.0.1", "localhost"]);
  });

  it("lanAppOriginFromEnv monta URL com porta", () => {
    expect(
      lanAppOriginFromEnv({ NODE_ENV: "development", ALLOWED_DEV_ORIGINS: "192.168.0.27", PORT: "3000" }),
    ).toBe("http://192.168.0.27:3000");
  });
});
