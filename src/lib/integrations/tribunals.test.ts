import { describe, expect, it } from "vitest";
import { pjeAdapter, esajAdapter, projudiAdapter, eprocAdapter } from "./tribunals";

const ctx = {
  workspaceId: "ws_test",
  config: {
    mode: "mock",
    processes: ["0001234-56.2024.8.26.0100", "0009999-00.2024.8.26.0001"],
    tribunalCode: "TJSP",
    uf: "SP",
  },
};

describe("tribunal adapters (mock)", () => {
  for (const a of [pjeAdapter, esajAdapter, projudiAdapter, eprocAdapter]) {
    it(`${a.provider} reporta health=ok em modo mock`, async () => {
      const h = await a.health(ctx);
      expect(h.ok).toBe(true);
      expect(h.code).toBe("MOCK_OK");
    });

    it(`${a.provider} fetchEvents devolve eventos determinísticos`, async () => {
      const out = a.fetchEvents ? await a.fetchEvents(ctx, { limit: 10 }) : [];
      expect(out.length).toBeGreaterThan(0);
      expect(out.length).toBeLessThanOrEqual(2);
      const fingerprints = out.map((e) => e.fingerprint);
      expect(new Set(fingerprints).size).toBe(out.length);
      const second = a.fetchEvents ? await a.fetchEvents(ctx, { limit: 10 }) : [];
      expect(second.map((e) => e.fingerprint)).toEqual(fingerprints);
    });

    it(`${a.provider} reporta MISSING_SECRET quando live + sem secret`, async () => {
      const h = await a.health({ workspaceId: "ws", config: { mode: "live" } });
      expect(h.ok).toBe(false);
      expect(h.code).toBe("MISSING_SECRET");
    });
  }

  it("eventos linkam ao processo via caseRef", async () => {
    const out = pjeAdapter.fetchEvents
      ? await pjeAdapter.fetchEvents(ctx, { limit: 5 })
      : [];
    expect(out[0]?.caseRef?.processNumber).toBe("0001234-56.2024.8.26.0100");
    expect(out[0]?.caseRef?.tribunalCode).toBe("TJSP");
  });
});
