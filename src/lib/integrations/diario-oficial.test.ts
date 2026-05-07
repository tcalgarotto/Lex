import { describe, expect, it } from "vitest";
import { diarioOficialAdapter } from "./diario-oficial";

describe("diarioOficialAdapter", () => {
  it("health falha se nenhum termo configurado", async () => {
    const h = await diarioOficialAdapter.health({ workspaceId: "ws", config: {} });
    expect(h.ok).toBe(false);
    expect(h.code).toBe("INVALID_CONFIG");
  });

  it("fetchEvents emite publicações determinísticas em mock", async () => {
    if (!diarioOficialAdapter.fetchEvents) throw new Error("contract");
    const ctx = {
      workspaceId: "ws",
      config: {
        watchTerms: ["OAB/SP 12345", "ESCRITORIO LTDA"],
        sections: ["DJE-SP", "DOU"],
        mode: "mock",
      },
    };
    const a = await diarioOficialAdapter.fetchEvents(ctx, { limit: 5 });
    const b = await diarioOficialAdapter.fetchEvents(ctx, { limit: 5 });
    expect(a.length).toBe(2);
    expect(a.map((e) => e.fingerprint)).toEqual(b.map((e) => e.fingerprint));
    expect(a[0]?.kind).toBe("PUBLICATION");
  });
});
