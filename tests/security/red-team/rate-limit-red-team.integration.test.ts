/**
 * FASE 2/10 — Rate limit fail-open vs fail-closed seletivo.
 */

import { describe, it, expect, vi, afterEach, afterAll, beforeAll } from "vitest";
import { assertRedTeamSafeEnvironment } from "../../../scripts/security-audit/env-guard";
import { RedTeamReport } from "./helpers";
import { rateLimit, isRateLimitFailClosedActive } from "@/lib/rate-limit";
import { isRedisAvailable } from "@/lib/redis";

const report = new RedTeamReport();

beforeAll(() => {
  const g = assertRedTeamSafeEnvironment();
  if (!g.ok) report.skip("Ambiente", g.reason);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => report.print());

describe("FASE 10 — Rate limit", () => {
  it("RL.1 rota leve: Redis offline → fail-open", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN_DEV", "1");
    vi.spyOn(await import("@/lib/redis"), "isRedisAvailable").mockResolvedValue(false);

    const r = await rateLimit({ key: "redteam:light", limit: 5, windowSeconds: 60, tier: "default" });
    expect(r.source).toBe("fail-open");
    expect(r.allowed).toBe(true);
    report.pass("RL.1 rota leve fail-open em dev", { obtained: r.source });
  });

  it("RL.2 rota cara: Redis offline + fail-closed → bloqueia (503)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN_DEV", "");
    vi.spyOn(await import("@/lib/redis"), "isRedisAvailable").mockResolvedValue(false);

    expect(isRateLimitFailClosedActive()).toBe(true);
    const r = await rateLimit({
      key: "redteam:expensive",
      limit: 5,
      windowSeconds: 60,
      tier: "expensive",
    });
    expect(r.source).toBe("fail-closed");
    expect(r.allowed).toBe(false);
    report.pass("RL.2 rota cara fail-closed sem Redis", {
      obtained: `source=${r.source} allowed=${r.allowed}`,
    });
  });

  it("RL.3 rota cara em dev com RATE_LIMIT_FAIL_OPEN_DEV → fail-open", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN_DEV", "1");
    vi.spyOn(await import("@/lib/redis"), "isRedisAvailable").mockResolvedValue(false);

    const r = await rateLimit({
      key: "redteam:expensive-dev",
      limit: 5,
      windowSeconds: 60,
      tier: "expensive",
    });
    expect(r.source).toBe("fail-open");
    report.pass("RL.3 dev pode usar fail-open explícito", { obtained: r.source });
  });

  it("RL.4 Redis real — contagem se disponível", async () => {
    const redisUp = await isRedisAvailable();
    if (!redisUp) {
      report.skip("RL.4 Redis ativo", "Redis indisponível neste ambiente");
      return;
    }
    const r = await rateLimit({
      key: `redteam:probe:${Date.now()}`,
      limit: 3,
      windowSeconds: 60,
      tier: "expensive",
    });
    expect(r.source).toBe("redis");
    report.pass("RL.4 Redis ativo", { obtained: `remaining=${r.remaining}` });
  });

  it("RL.5 rotas IA têm enforceAiRouteRateLimit no handler", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const root = resolve(process.cwd(), "src/app/api");
    const targets = ["completion/route.ts", "chat/[threadId]/route.ts", "generate/piece/route.ts"];
    const missing: string[] = [];
    for (const t of targets) {
      const src = readFileSync(resolve(root, t), "utf8");
      if (!src.includes("enforceAiRouteRateLimit")) missing.push(t);
    }
    if (missing.length === 0) {
      report.pass("RL.5 rotas IA com rate limit explícito");
    } else {
      report.fail("RL.5 rotas IA sem enforceAiRouteRateLimit", {
        severity: "P1",
        obtained: missing.join(", "),
      });
    }
    expect(missing).toHaveLength(0);
  });
});
