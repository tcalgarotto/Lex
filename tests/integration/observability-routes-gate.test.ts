import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * F15 — Garante que as rotas mapeiam falha de `requirePermission("observabilityView")`
 * para 403 (e não vazam 200). A matriz role × permissão em si continua coberta por
 * `permissions.test.ts` — aqui o alvo é o contrato HTTP das rotas admin/cockpit.
 */
describe("F15 — rotas observabilidade negam sem permissão", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    vi.resetModules();
    const session = await import("@/lib/auth/session");
    vi.spyOn(session, "requirePermission").mockRejectedValue(
      new Error("Permissão insuficiente: observabilityView"),
    );
  });

  it("GET /api/cockpit/checklist -> 403 quando observabilityView falha", async () => {
    const { GET } = await import("@/app/api/cockpit/checklist/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/corpus-stats -> 403 quando observabilityView falha", async () => {
    const { GET } = await import("@/app/api/admin/corpus-stats/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET /api/strategy/analyze -> 403 quando observabilityView falha", async () => {
    const { GET } = await import("@/app/api/strategy/analyze/route");
    const res = await GET(
      new Request("http://test.local/api/strategy/analyze?q=contrato+de+compra+e+venda"),
    );
    expect(res.status).toBe(403);
  });
});
