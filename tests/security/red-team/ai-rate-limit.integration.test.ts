/**
 * Rate limit IA — chaves por workspace/usuário e bloqueio antes do provider.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { aiRateLimitKey, enforceAiRouteRateLimit } from "@/lib/rate-limit-ai";
import { RT } from "./fixture-ids";

describe("AI rate limit keys", () => {
  it("usuário A e B não compartilham chave", () => {
    const kA = aiRateLimitKey(RT.workspaces.a.id, RT.users.commonA.id, "chat");
    const kB = aiRateLimitKey(RT.workspaces.b.id, RT.users.commonB.id, "chat");
    expect(kA).not.toBe(kB);
  });

  it("workspace A e B não compartilham chave para mesmo userId fictício", () => {
    const kA = aiRateLimitKey(RT.workspaces.a.id, "u1", "completion");
    const kB = aiRateLimitKey(RT.workspaces.b.id, "u1", "completion");
    expect(kA).not.toBe(kB);
  });
});

describe("AI rate limit enforcement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("bloqueia com fail-closed quando Redis offline em modo produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN_DEV", "");
    vi.spyOn(await import("@/lib/redis"), "isRedisAvailable").mockResolvedValue(false);

    const out = await enforceAiRouteRateLimit({
      workspaceId: RT.workspaces.a.id,
      userId: RT.users.commonA.id,
      routeName: "chat",
      limit: 1,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.response.status).toBe(503);
    }
  });
});
