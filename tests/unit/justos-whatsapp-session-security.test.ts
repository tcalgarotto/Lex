import { describe, expect, it } from "vitest";
import { buildSessionKey } from "@/lib/justos/whatsapp/session-service";

describe("WhatsApp session security", () => {
  it("sessionKey derivado do workspace — client não pode escolher outro tenant", () => {
    const wsA = "cmov676gj0000wm6kx7l7pm4c";
    const wsB = "cmov8u5qk0000wmsvrvn6v7wt";
    const keyA = buildSessionKey(wsA);
    const keyB = buildSessionKey(wsB);
    expect(keyA).not.toBe(keyB);
    expect(buildSessionKey(wsA)).toBe(keyA);
  });

  it("sessionKey não é o workspaceId em claro", () => {
    const ws = "clxxxxxxxxxxxxxxxx";
    expect(buildSessionKey(ws)).not.toBe(ws);
  });
});
