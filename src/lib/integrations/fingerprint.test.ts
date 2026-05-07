import { describe, expect, it } from "vitest";
import { fingerprintOf } from "./fingerprint";

describe("fingerprintOf", () => {
  it("é determinístico para os mesmos inputs", () => {
    const a = fingerprintOf(["PJE", "0001234-56.2024.8.26.0100", "2026-05-07T10:00:00Z"]);
    const b = fingerprintOf(["PJE", "0001234-56.2024.8.26.0100", "2026-05-07T10:00:00Z"]);
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("difere quando qualquer parte muda", () => {
    const a = fingerprintOf(["PJE", "p1", "t1"]);
    const b = fingerprintOf(["PJE", "p2", "t1"]);
    const c = fingerprintOf(["ESAJ", "p1", "t1"]);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it("normaliza nullish para vazio", () => {
    const a = fingerprintOf(["x", null, undefined]);
    const b = fingerprintOf(["x", "", ""]);
    expect(a).toBe(b);
  });

  it("é case-insensitive em strings", () => {
    expect(fingerprintOf(["PJE"])).toBe(fingerprintOf(["pje"]));
  });
});
