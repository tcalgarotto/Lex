import { test, expect } from "@playwright/test";

/**
 * /api/ready é liveness puro (não depende de nada). Sempre 200.
 * /api/health checa db/redis/qdrant/supabase. Em ambiente local pode estar
 * degraded; aqui validamos apenas que o endpoint existe e responde JSON.
 */
test.describe("health endpoints", () => {
  test("GET /api/ready -> 200 com ready=true", async ({ request }) => {
    const res = await request.get("/api/ready");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /api/health -> JSON com checks por componente", async ({ request }) => {
    const res = await request.get("/api/health");
    // 200 = ok | degraded; 503 = down (algum check `required` falhou — ex.: DB
    // ausente em CI E2E). Os três são respostas estruturadas válidas.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(body.checks).toBeDefined();
    for (const k of ["db", "redis", "qdrant", "supabase"]) {
      expect(body.checks[k]).toBeDefined();
      expect(typeof body.checks[k].latencyMs).toBe("number");
    }
  });
});
