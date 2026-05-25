import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isLexN8nServiceAuthorized } from "./n8n-auth";

describe("isLexN8nServiceAuthorized", () => {
  const prev = process.env["LEX_N8N_SERVICE_TOKEN"];

  beforeEach(() => {
    process.env["LEX_N8N_SERVICE_TOKEN"] = "test-token-abc";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env["LEX_N8N_SERVICE_TOKEN"];
    else process.env["LEX_N8N_SERVICE_TOKEN"] = prev;
  });

  it("aceita Bearer válido", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer test-token-abc" },
    });
    expect(isLexN8nServiceAuthorized(req)).toBe(true);
  });

  it("rejeita token errado", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(isLexN8nServiceAuthorized(req)).toBe(false);
  });
});
