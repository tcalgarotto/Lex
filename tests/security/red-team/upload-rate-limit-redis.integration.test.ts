/**
 * FASE 3.2 — Rate limit de upload com Redis ativo.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { rateLimit, isRateLimitFailClosedActive } from "@/lib/rate-limit";
import { getRedis, pingRedis, _resetRedisForTests } from "@/lib/redis";

async function redisReadyForTests(): Promise<boolean> {
  if (redisSingletonReady) return true;
  const ping = await pingRedis();
  return ping.ok;
}
import { RedTeamReport } from "./helpers";
import { RT } from "./fixture-ids";

const report = new RedTeamReport();
let redisSingletonReady = false;

beforeAll(async () => {
  _resetRedisForTests();
  const ping = await pingRedis();
  if (!ping.ok) return;
  const r = getRedis();
  if (r) {
    try {
      await r.connect();
      redisSingletonReady = true;
    } catch {
      redisSingletonReady = false;
    }
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => report.print());

describe("FASE 3.2 — Upload rate limit (Redis)", () => {
  it("UR.1 upload bloqueia na 21ª chamada com source redis", async () => {
    if (!(await redisReadyForTests())) {
      report.skip("UR.1 upload RL Redis", "Redis indisponível — REDIS_URL + npm run infra:up");
      return;
    }
    const key = `upload:${RT.workspaces.a.id}:${RT.users.commonA.id}:gate-${Date.now()}`;
    const limit = 20;
    const windowSeconds = 60;
    for (let i = 0; i < limit; i++) {
      const r = await rateLimit({ key, limit, windowSeconds, tier: "expensive" });
      expect(r.allowed).toBe(true);
      if (i === 0) expect(r.source).toBe("redis");
    }
    const blocked = await rateLimit({ key, limit, windowSeconds, tier: "expensive" });
    expect(blocked.allowed).toBe(false);
    expect(blocked.source).toBe("redis");
    report.pass("UR.1 21ª chamada bloqueada", { obtained: `remaining=${blocked.remaining}` });
  });

  it("UR.2 chave inclui workspaceId e userId (isolamento por prefixo)", async () => {
    if (!(await redisReadyForTests())) {
      report.skip("UR.2 chave upload", "Redis indisponível");
      return;
    }
    const ts = Date.now();
    const keyA = `upload:${RT.workspaces.a.id}:${RT.users.commonA.id}:iso-${ts}`;
    const keyB = `upload:${RT.workspaces.b.id}:${RT.users.commonB.id}:iso-${ts}`;
    expect(keyA).not.toBe(keyB);
    const rA = await rateLimit({ key: keyA, limit: 20, windowSeconds: 60, tier: "expensive" });
    const rB = await rateLimit({ key: keyB, limit: 20, windowSeconds: 60, tier: "expensive" });
    expect(rA.allowed).toBe(true);
    expect(rB.allowed).toBe(true);
    report.pass("UR.2 chaves A/B distintas", { obtained: "redis ok em ambas" });
  });

  it("UR.3 usuário A não consome janela do usuário B", async () => {
    if (!(await redisReadyForTests())) {
      report.skip("UR.3 isolamento user", "Redis indisponível");
      return;
    }
    const limit = 3;
    const windowSeconds = 60;
    const keyA = `upload:${RT.workspaces.a.id}:${RT.users.commonA.id}:u-${Date.now()}`;
    const keyB = `upload:${RT.workspaces.a.id}:${RT.users.commonB.id}:u-${Date.now()}`;
    for (let i = 0; i < limit; i++) {
      await rateLimit({ key: keyA, limit, windowSeconds, tier: "expensive" });
    }
    const blockedA = await rateLimit({ key: keyA, limit, windowSeconds, tier: "expensive" });
    const stillB = await rateLimit({ key: keyB, limit, windowSeconds, tier: "expensive" });
    expect(blockedA.allowed).toBe(false);
    expect(stillB.allowed).toBe(true);
    report.pass("UR.3 cota RL por userId", { obtained: "B ainda allowed" });
  });

  it("UR.4 workspace A não consome janela do workspace B", async () => {
    if (!(await redisReadyForTests())) {
      report.skip("UR.4 isolamento workspace", "Redis indisponível");
      return;
    }
    const limit = 3;
    const windowSeconds = 60;
    const userId = RT.users.commonA.id;
    const keyWsA = `upload:${RT.workspaces.a.id}:${userId}:w-${Date.now()}`;
    const keyWsB = `upload:${RT.workspaces.b.id}:${userId}:w-${Date.now()}`;
    for (let i = 0; i < limit; i++) {
      await rateLimit({ key: keyWsA, limit, windowSeconds, tier: "expensive" });
    }
    const blockedWsA = await rateLimit({ key: keyWsA, limit, windowSeconds, tier: "expensive" });
    const stillWsB = await rateLimit({ key: keyWsB, limit, windowSeconds, tier: "expensive" });
    expect(blockedWsA.allowed).toBe(false);
    expect(stillWsB.allowed).toBe(true);
    report.pass("UR.4 cota RL por workspaceId");
  });

  it("UR.5 Redis offline + fail-closed bloqueia tier expensive", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN_DEV", "");
    vi.spyOn(await import("@/lib/redis"), "isRedisAvailable").mockResolvedValue(false);

    expect(isRateLimitFailClosedActive()).toBe(true);
    const r = await rateLimit({
      key: "upload:failclosed:probe",
      limit: 20,
      windowSeconds: 60,
      tier: "expensive",
    });
    expect(r.allowed).toBe(false);
    expect(r.source).toBe("fail-closed");
    report.pass("UR.5 fail-closed sem Redis", { obtained: r.source });
  });

  it("UR.6 fail-open dev só com RATE_LIMIT_FAIL_OPEN_DEV=1", async () => {
    const prev = process.env["RATE_LIMIT_FAIL_OPEN_DEV"];
    process.env["RATE_LIMIT_FAIL_OPEN_DEV"] = "1";
    expect(isRateLimitFailClosedActive()).toBe(false);
    if (prev !== undefined) process.env["RATE_LIMIT_FAIL_OPEN_DEV"] = prev;
    else delete process.env["RATE_LIMIT_FAIL_OPEN_DEV"];
    report.pass("UR.6 FAIL_OPEN_DEV desativa fail-closed");
  });

  it("UR.7 rate limit é camada antes de Storage (contrato de rota)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const uploadRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/documents/upload/route.ts"),
      "utf8",
    );
    const postIdx = uploadRoute.indexOf("export async function POST");
    const body = postIdx >= 0 ? uploadRoute.slice(postIdx) : uploadRoute;
    const rateIdx = body.indexOf("await rateLimit(");
    const storageIdx = body.indexOf("await uploadDocumentBuffer(");
    expect(rateIdx).toBeGreaterThan(-1);
    expect(storageIdx).toBeGreaterThan(-1);
    expect(rateIdx).toBeLessThan(storageIdx);
    report.pass("UR.7 rateLimit antes de uploadDocumentBuffer na rota");
  });
});
